import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import type { AuthRequest } from '../types.js';
import { accountActionSchema, accountSchema, paymentQuerySchema } from '../validators/accounts.js';
import { recordPartyPayment, reversePayment } from '../services/paymentService.js';

const router = Router();
const managers = ['ADMIN', 'MANAGER'];
const decimal = (value: any) => value?.toString?.() ?? String(value ?? 0);
const paymentDto = (p: any) => ({ ...p, amount: decimal(p.amount), account: p.account ? { ...p.account, openingBalance: decimal(p.account.openingBalance), currentBalance: decimal(p.account.currentBalance) } : null });

router.get('/accounts/summary', requireAuth, async (_req, res, next) => {
  try {
    const [customers, suppliers, accounts, payments] = await Promise.all([
      prisma.customer.findMany({ include: { ledgers: { select: { debit: true, credit: true } } } }),
      prisma.supplier.findMany({ include: { ledgers: { select: { debit: true, credit: true } } } }),
      prisma.financialAccount.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.payment.findMany({ where: { paymentDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: 'COMPLETED' } }),
    ]);
    const receivable = customers.reduce((n, c) => n + Math.max(0, c.ledgers.reduce((a, e) => a + Number(e.debit) - Number(e.credit), 0)), 0);
    const payable = suppliers.reduce((n, s) => n + Math.max(0, s.ledgers.reduce((a, e) => a + Number(e.credit) - Number(e.debit), 0)), 0);
    const moneyIn = payments.filter((p) => ['CUSTOMER_PAYMENT', 'CUSTOMER_ADVANCE', 'OTHER_INCOME'].includes(p.paymentType || p.type)).reduce((n, p) => n + Number(p.amount), 0);
    const moneyOut = payments.filter((p) => ['SUPPLIER_PAYMENT', 'SUPPLIER_ADVANCE', 'OTHER_PAYMENT'].includes(p.paymentType || p.type)).reduce((n, p) => n + Number(p.amount), 0);
    res.json({ receivable, payable, customerAdvances: customers.reduce((n, c) => n + Number(c.advanceBalance), 0), supplierAdvances: suppliers.reduce((n, s) => n + Number(s.advanceBalance), 0), todayReceived: moneyIn, todayPaid: moneyOut, cashBalance: accounts.filter((a) => a.type === 'CASH').reduce((n, a) => n + Number(a.currentBalance), 0), bankBalance: accounts.filter((a) => a.type === 'BANK').reduce((n, a) => n + Number(a.currentBalance), 0), accounts: accounts.map((a) => ({ ...a, openingBalance: decimal(a.openingBalance), currentBalance: decimal(a.currentBalance) })) });
  } catch (e) { next(e); }
});

router.get('/accounts', requireAuth, async (_req, res, next) => { try { const accounts = await prisma.financialAccount.findMany({ orderBy: { name: 'asc' } }); res.json({ accounts: accounts.map((a) => ({ ...a, openingBalance: decimal(a.openingBalance), currentBalance: decimal(a.currentBalance) })) }); } catch (e) { next(e); } });
router.post('/accounts', requireAuth, allowRoles('ADMIN'), async (req: AuthRequest, res, next) => { try { const input = accountSchema.parse(req.body); const account = await prisma.financialAccount.create({ data: { name: input.name, type: input.type, openingBalance: input.openingBalance, currentBalance: input.openingBalance, accountNumber: input.accountNumber || null, bankName: input.bankName || null, notes: input.notes || null, createdBy: req.user!.id } }); res.status(201).json({ account: { ...account, openingBalance: decimal(account.openingBalance), currentBalance: decimal(account.currentBalance) } }); } catch (e) { next(e); } });

async function action(req: AuthRequest, res: any, next: any, party: 'CUSTOMER' | 'SUPPLIER', actionType: 'PAYMENT' | 'ADVANCE') {
  try {
    const input = accountActionSchema.parse(req.body);
    const result = await prisma.$transaction((tx) => recordPartyPayment(tx, { party, action: actionType, partyId: input.partyId, amount: input.amount, method: input.method, date: input.date, reference: input.reference, notes: input.notes, accountId: input.accountId, createdBy: req.user!.id }));
    res.status(201).json({ payment: paymentDto(result.payment), transaction: result.transaction, account: { ...result.account, currentBalance: decimal(result.account.currentBalance) } });
  } catch (e) { next(e); }
}
router.post('/accounts/customer-payment', requireAuth, allowRoles(...managers), (req, res, next) => action(req, res, next, 'CUSTOMER', 'PAYMENT'));
router.post('/accounts/supplier-payment', requireAuth, allowRoles(...managers), (req, res, next) => action(req, res, next, 'SUPPLIER', 'PAYMENT'));
router.post('/accounts/customer-advance', requireAuth, allowRoles(...managers), (req, res, next) => action(req, res, next, 'CUSTOMER', 'ADVANCE'));
router.post('/accounts/supplier-advance', requireAuth, allowRoles(...managers), (req, res, next) => action(req, res, next, 'SUPPLIER', 'ADVANCE'));

router.get('/accounts/payments', requireAuth, async (req, res, next) => {
  try {
    const q = paymentQuerySchema.parse(req.query); const where: Prisma.PaymentWhereInput = { ...(q.type ? { paymentType: q.type } : {}), ...(q.method ? { method: q.method } : {}), ...(q.customerId ? { customerId: q.customerId } : {}), ...(q.supplierId ? { supplierId: q.supplierId } : {}), ...(q.from || q.to ? { paymentDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}), ...(q.search ? { OR: [{ paymentNumber: { contains: q.search, mode: 'insensitive' } }, { reference: { contains: q.search, mode: 'insensitive' } }, { customer: { name: { contains: q.search, mode: 'insensitive' } } }, { supplier: { name: { contains: q.search, mode: 'insensitive' } } }] } : {}) };
    const [payments, total] = await prisma.$transaction([prisma.payment.findMany({ where, include: { customer: true, supplier: true, account: true, user: { select: { name: true } }, sale: { select: { invoiceNumber: true } }, purchase: { select: { purchaseNumber: true } } }, orderBy: { paymentDate: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }), prisma.payment.count({ where })]);
    res.json({ payments: payments.map(paymentDto), pagination: { page: q.page, pageSize: q.pageSize, total, pages: Math.ceil(total / q.pageSize) } });
  } catch (e) { next(e); }
});
router.get('/accounts/payments/:id', requireAuth, async (req, res, next) => { try { const payment = await prisma.payment.findUnique({ where: { id: String(req.params.id) }, include: { customer: true, supplier: true, account: true, user: { select: { name: true } }, sale: { select: { id: true, invoiceNumber: true } }, purchase: { select: { id: true, purchaseNumber: true } } } }); if (!payment) return res.status(404).json({ message: 'Payment not found.' }); res.json({ payment: paymentDto(payment) }); } catch (e) { next(e); } });
router.post('/accounts/payments/:id/reverse', requireAuth, allowRoles('ADMIN'), async (req: AuthRequest, res, next) => { try { const reason = String(req.body?.reason || '').trim(); if (reason.length < 3) return res.status(400).json({ message: 'A reversal reason is required.' }); const result = await prisma.$transaction((tx) => reversePayment(tx, String(req.params.id), reason, req.user!.id)); res.status(201).json({ payment: paymentDto(result.payment), transaction: result.transaction }); } catch (e) { next(e); } });

router.get('/accounts/transactions', requireAuth, async (req, res, next) => { try { const q = paymentQuerySchema.parse(req.query); const where: Prisma.TransactionWhereInput = { ...(q.type ? { type: q.type } : {}), ...(q.customerId ? { customerId: q.customerId } : {}), ...(q.supplierId ? { supplierId: q.supplierId } : {}), ...(q.from || q.to ? { transactionDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}) }; const transactions = await prisma.transaction.findMany({ where, include: { account: true, customer: true, supplier: true, user: { select: { name: true } } }, orderBy: { transactionDate: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }); res.json({ transactions: transactions.map((t) => ({ ...t, amount: decimal(t.amount), account: t.account ? { ...t.account, currentBalance: decimal(t.account.currentBalance), openingBalance: decimal(t.account.openingBalance) } : null })) }); } catch (e) { next(e); } });
export default router;
