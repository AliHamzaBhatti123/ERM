import { Prisma } from '@prisma/client';

const money = (value: Prisma.Decimal | number) => new Prisma.Decimal(value);
type Party = 'CUSTOMER' | 'SUPPLIER';
type Action = 'PAYMENT' | 'ADVANCE';
export type PaymentInput = { party: Party; action: Action; partyId: string; amount: number; method: string; date?: Date; reference?: string; notes?: string; accountId?: string; createdBy: string };

export async function accountFor(tx: Prisma.TransactionClient, method: string, accountId?: string) {
  if (accountId) {
    const account = await tx.financialAccount.findUnique({ where: { id: accountId } });
    if (!account || account.status !== 'ACTIVE') throw Object.assign(new Error('Active financial account is required.'), { statusCode: 400 });
    return account;
  }
  const type = method === 'Cash' ? 'CASH' : 'BANK';
  return tx.financialAccount.upsert({ where: { name: type === 'CASH' ? 'Main Cash' : 'Main Bank' }, update: {}, create: { name: type === 'CASH' ? 'Main Cash' : 'Main Bank', type, openingBalance: 0, currentBalance: 0 } });
}

export async function nextPaymentNumber(tx: Prisma.TransactionClient, prefix: 'PAY' | 'ADV') {
  const sequence = await tx.paymentSequence.upsert({ where: { id: 1 }, update: { nextNumber: { increment: 1 } }, create: { id: 1, nextNumber: 2 } });
  return prefix + '-' + String(sequence.nextNumber - 1).padStart(6, '0');
}

export async function recordPartyPayment(tx: Prisma.TransactionClient, input: PaymentInput) {
  const isCustomer = input.party === 'CUSTOMER';
  const entity = isCustomer ? await tx.customer.findUnique({ where: { id: input.partyId } }) : await tx.supplier.findUnique({ where: { id: input.partyId } });
  if (!entity) throw Object.assign(new Error((isCustomer ? 'Customer' : 'Supplier') + ' not found.'), { statusCode: 404 });
  if (entity.status !== 'ACTIVE') throw Object.assign(new Error('Inactive account cannot receive normal transactions.'), { statusCode: 400 });
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw Object.assign(new Error('Payment amount must be greater than zero.'), { statusCode: 400 });
  const entries = await tx.ledger.findMany({ where: isCustomer ? { customerId: input.partyId } : { supplierId: input.partyId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const debitTotal = entries.reduce((n, e) => n + Number(e.debit), 0); const creditTotal = entries.reduce((n, e) => n + Number(e.credit), 0);
  const outstanding = isCustomer ? Math.max(0, debitTotal - creditTotal) : Math.max(0, creditTotal - debitTotal);
  if (input.action === 'PAYMENT' && input.amount > outstanding + 0.005) throw Object.assign(new Error('Payment exceeds current ' + (isCustomer ? 'receivable' : 'payable') + ' of ' + outstanding.toFixed(2) + '.'), { statusCode: 400 });
  const date = input.date || new Date(); const account = await accountFor(tx, input.method, input.accountId);
  const type = input.action === 'PAYMENT' ? (isCustomer ? 'CUSTOMER_PAYMENT' : 'SUPPLIER_PAYMENT') : (isCustomer ? 'CUSTOMER_ADVANCE' : 'SUPPLIER_ADVANCE');
  const legacyType = input.action === 'PAYMENT' ? (isCustomer ? 'PAYMENT_RECEIVED' : 'PAYMENT_MADE') : type;
  const previous = entries.length ? Number(entries[entries.length - 1].balance) : 0; const debit = input.action === 'ADVANCE' ? 0 : isCustomer ? 0 : input.amount; const credit = input.action === 'ADVANCE' ? 0 : isCustomer ? input.amount : 0;
  const paymentNumber = await nextPaymentNumber(tx, input.action === 'ADVANCE' ? 'ADV' : 'PAY');
  const payment = await tx.payment.create({ data: { paymentNumber, paymentType: type, status: 'COMPLETED', amount: money(input.amount), method: input.method, type: legacyType, paymentDate: date, reference: input.reference || paymentNumber, notes: input.notes || null, customerId: isCustomer ? input.partyId : null, supplierId: isCustomer ? null : input.partyId, accountId: account.id, createdBy: input.createdBy } });
  await tx.ledger.create({ data: { customerId: isCustomer ? input.partyId : null, supplierId: isCustomer ? null : input.partyId, transactionType: legacyType, referenceId: payment.id, referenceType: paymentNumber, description: input.notes || type, debit: money(debit), credit: money(credit), balance: money(previous + debit - credit), createdAt: date, createdBy: input.createdBy } });
  if (input.action === 'ADVANCE') {
    if (isCustomer) await tx.customer.update({ where: { id: input.partyId }, data: { advanceBalance: { increment: money(input.amount) } } }); else await tx.supplier.update({ where: { id: input.partyId }, data: { advanceBalance: { increment: money(input.amount) } } });
    await tx.advance.create({ data: { partyType: input.party, customerId: isCustomer ? input.partyId : null, supplierId: isCustomer ? null : input.partyId, amount: money(input.amount), advanceDate: date, method: input.method, reference: input.reference || paymentNumber, notes: input.notes || null, createdBy: input.createdBy } });
  }
  const accountDelta = isCustomer ? input.amount : -input.amount;
  await tx.financialAccount.update({ where: { id: account.id }, data: { currentBalance: { increment: money(accountDelta) } } });
  const transaction = await tx.transaction.create({ data: { type, amount: money(input.amount), customerId: isCustomer ? input.partyId : null, supplierId: isCustomer ? null : input.partyId, paymentId: payment.id, accountId: account.id, paymentMethod: input.method, reference: input.reference || paymentNumber, description: input.notes || type, transactionDate: date, createdBy: input.createdBy } });
  return { payment, transaction, account };
}

export async function reversePayment(tx: Prisma.TransactionClient, paymentId: string, reason: string, userId: string) {
  const original = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!original) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 });
  if (original.status === 'REVERSED') throw Object.assign(new Error('Payment is already reversed.'), { statusCode: 400 });
  if (!original.accountId) throw Object.assign(new Error('Payment has no linked financial account.'), { statusCode: 400 });
  const isCustomer = Boolean(original.customerId); const reversalNumber = await nextPaymentNumber(tx, 'PAY');
  const reversal = await tx.payment.create({ data: { paymentNumber: reversalNumber, paymentType: 'REVERSAL', status: 'COMPLETED', amount: original.amount, method: original.method, type: isCustomer ? 'CUSTOMER_PAYMENT_REVERSAL' : 'SUPPLIER_PAYMENT_REVERSAL', paymentDate: new Date(), reference: reversalNumber, notes: reason, customerId: original.customerId, supplierId: original.supplierId, accountId: original.accountId, reversalOfId: original.id, createdBy: userId } });
  await tx.payment.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
  const entries = await tx.ledger.findMany({ where: isCustomer ? { customerId: original.customerId! } : { supplierId: original.supplierId! }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const previous = entries.length ? Number(entries[entries.length - 1].balance) : 0; const debit = isCustomer ? Number(original.amount) : 0; const credit = isCustomer ? 0 : Number(original.amount);
  await tx.ledger.create({ data: { customerId: original.customerId, supplierId: original.supplierId, transactionType: 'ADJUSTMENT', referenceId: reversal.id, referenceType: reversalNumber, description: 'Reversal: ' + reason, debit: money(debit), credit: money(credit), balance: money(previous + debit - credit), createdBy: userId } });
  const delta = isCustomer ? -Number(original.amount) : Number(original.amount);
  await tx.financialAccount.update({ where: { id: original.accountId }, data: { currentBalance: { increment: money(delta) } } });
  const transaction = await tx.transaction.create({ data: { type: 'ADJUSTMENT', amount: original.amount, customerId: original.customerId, supplierId: original.supplierId, paymentId: reversal.id, accountId: original.accountId, reference: reversalNumber, description: 'Reversal: ' + reason, transactionDate: new Date(), createdBy: userId } });
  return { payment: reversal, transaction };
}
