import { Router } from 'express';
import { prisma } from '../db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import type { AuthRequest } from '../types.js';
import { buildDashboard, rangeDates } from '../services/dashboardService.js';

const router = Router();
const decimal = (v: any) => v?.toString?.() ?? String(v ?? 0);

router.get('/dashboard', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = await buildDashboard(prisma, String(req.query.startDate || ''), String(req.query.endDate || ''));
    if (req.user!.role === 'STAFF') {
      return res.json({ ...data, grossProfit: null, netProfit: null, cogs: null, cashBalance: null, bankBalance: null, payables: null, receivables: null, customerAdvances: null, supplierAdvances: null, topProducts: data.topProducts.map((p: any) => ({ product: p.product, sku: p.sku, quantity: p.quantity, revenue: p.revenue })) });
    }
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/reports/summary', requireAuth, async (req, res, next) => {
  try {
    const data = await buildDashboard(prisma, String(req.query.startDate || ''), String(req.query.endDate || ''));
    if (req.user!.role === 'STAFF') return res.json({ ...data, grossProfit: null, netProfit: null, cogs: null, cashBalance: null, bankBalance: null, payables: null, receivables: null, customerAdvances: null, supplierAdvances: null });
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/admin/data-integrity', requireAuth, allowRoles('ADMIN'), async (_req, res, next) => {
  try {
    const [sales, purchases, products, customers, suppliers, accounts, payments] = await Promise.all([
      prisma.sale.findMany({ include: { items: true } }), prisma.purchase.findMany({ include: { items: true } }),
      prisma.product.findMany({ include: { inventoryTransactions: true } }), prisma.customer.findMany({ include: { ledgers: true } }),
      prisma.supplier.findMany({ include: { ledgers: true } }), prisma.financialAccount.findMany({ include: { transactions: true } }),
      prisma.payment.findMany({ include: { transactions: true } }),
    ]);
    const saleErrors = sales.filter((s) => Math.abs(Number(s.total) - s.items.reduce((a, i) => a + Number(i.total), 0)) > 0.01);
    const purchaseErrors = purchases.filter((p) => Math.abs(Number(p.total) - p.items.reduce((a, i) => a + Number(i.total), 0)) > 0.01);
    const accountWarnings = accounts.map((a) => { const movement = a.transactions.reduce((n, t) => n + (['CUSTOMER_PAYMENT', 'CUSTOMER_ADVANCE', 'OTHER_INCOME', 'ACCOUNT_TRANSFER_IN'].includes(t.type) ? Number(t.amount) : -Number(t.amount)), 0); return { account: a.name, stored: decimal(a.currentBalance), calculated: decimal(Number(a.openingBalance) + movement), status: Math.abs(Number(a.openingBalance) + movement - Number(a.currentBalance)) < 0.01 ? 'PASS' : 'WARNING' }; });
    res.json({ checks: { sales: { status: saleErrors.length ? 'ERROR' : 'PASS', errors: saleErrors.length }, purchases: { status: purchaseErrors.length ? 'ERROR' : 'PASS', errors: purchaseErrors.length }, inventory: { status: products.every((p) => p.currentStock !== null) ? 'PASS' : 'WARNING', products: products.length }, customers: { status: customers.every((c) => c.ledgers.length >= 0) ? 'PASS' : 'WARNING', customers: customers.length }, suppliers: { status: suppliers.every((s) => s.ledgers.length >= 0) ? 'PASS' : 'WARNING', suppliers: suppliers.length }, accounts: accountWarnings, payments: { status: payments.every((p) => p.transactions.length > 0 || !p.paymentType) ? 'PASS' : 'WARNING', payments: payments.length } } });
  } catch (e) { next(e); }
});

router.get('/reports/csv', requireAuth, async (req, res, next) => { try { const data = await buildDashboard(prisma, String(req.query.startDate || ''), String(req.query.endDate || '')); const rows = [['Metric', 'Amount'], ['Sales', data.sales], ['Purchases', data.purchases], ['Gross Profit', data.grossProfit], ['Net Profit', data.netProfit], ['Expenses', data.expenses], ['Other Income', data.otherIncome], ['Receivables', data.receivables], ['Payables', data.payables]]; res.type('text/csv').send(rows.map((r) => r.join(',')).join('\n')); } catch (e) { next(e); } });

export default router;
