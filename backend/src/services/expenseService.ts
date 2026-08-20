import { Prisma } from '@prisma/client';
import { accountFor, nextPaymentNumber } from './paymentService.js';

const money = (value: Prisma.Decimal | number) => new Prisma.Decimal(value);

export async function createExpense(tx: Prisma.TransactionClient, input: any, userId: string) {
  const category = await tx.expenseCategory.findUnique({ where: { id: input.categoryId } });
  if (!category || category.status !== 'ACTIVE') throw Object.assign(new Error('Active expense category is required.'), { statusCode: 400 });
  const account = await tx.financialAccount.findUnique({ where: { id: input.accountId } });
  if (!account || account.status !== 'ACTIVE') throw Object.assign(new Error('Active financial account is required.'), { statusCode: 400 });
  if (Number(account.currentBalance) < input.amount) throw Object.assign(new Error('Insufficient account balance.'), { statusCode: 400 });
  const date = input.date || new Date();
  const sequence = await tx.expenseSequence.upsert({ where: { id: 1 }, update: { nextNumber: { increment: 1 } }, create: { id: 1, nextNumber: 2 } });
  const expenseNumber = 'EXP-' + String(sequence.nextNumber - 1).padStart(6, '0');
  const expense = await tx.expense.create({ data: { expenseNumber, categoryId: input.categoryId, amount: money(input.amount), expenseDate: date, paymentMethod: input.paymentMethod, accountId: input.accountId, description: input.description || null, reference: input.reference || expenseNumber, notes: input.notes || null, createdBy: userId } });
  const paymentNumber = await nextPaymentNumber(tx, 'PAY');
  const payment = await tx.payment.create({ data: { paymentNumber, paymentType: 'OTHER_PAYMENT', type: 'OTHER_PAYMENT', amount: money(input.amount), method: input.paymentMethod, paymentDate: date, reference: input.reference || expenseNumber, notes: input.notes || input.description || null, accountId: input.accountId, expenseId: expense.id, createdBy: userId } });
  await tx.financialAccount.update({ where: { id: input.accountId }, data: { currentBalance: { decrement: money(input.amount) } } });
  const transaction = await tx.transaction.create({ data: { type: 'EXPENSE', amount: money(input.amount), accountId: input.accountId, paymentId: payment.id, expenseId: expense.id, paymentMethod: input.paymentMethod, reference: input.reference || expenseNumber, description: input.description || 'Expense', transactionDate: date, createdBy: userId } });
  return { expense, payment, transaction };
}

export async function reverseExpense(tx: Prisma.TransactionClient, expenseId: string, reason: string, userId: string) {
  const expense = await tx.expense.findUnique({ where: { id: expenseId }, include: { payments: { where: { status: 'COMPLETED' }, take: 1 } } });
  if (!expense) throw Object.assign(new Error('Expense not found.'), { statusCode: 404 });
  if (expense.status === 'REVERSED') throw Object.assign(new Error('Expense is already reversed.'), { statusCode: 400 });
  const original = expense.payments[0];
  await tx.expense.update({ where: { id: expenseId }, data: { status: 'REVERSED' } });
  if (original) await tx.payment.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
  const reversalNumber = await nextPaymentNumber(tx, 'PAY');
  const payment = await tx.payment.create({ data: { paymentNumber: reversalNumber, paymentType: 'EXPENSE_REVERSAL', type: 'EXPENSE_REVERSAL', amount: expense.amount, method: expense.paymentMethod, paymentDate: new Date(), reference: reversalNumber, notes: reason, accountId: expense.accountId, expenseId: expense.id, reversalOfId: original?.id, createdBy: userId } });
  await tx.financialAccount.update({ where: { id: expense.accountId }, data: { currentBalance: { increment: expense.amount } } });
  const transaction = await tx.transaction.create({ data: { type: 'EXPENSE_REVERSAL', amount: expense.amount, accountId: expense.accountId, paymentId: payment.id, expenseId: expense.id, reference: reversalNumber, description: 'Expense reversal: ' + reason, transactionDate: new Date(), createdBy: userId } });
  return { expense, payment, transaction };
}
