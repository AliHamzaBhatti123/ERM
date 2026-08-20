import { Prisma } from '@prisma/client';
import { nextPaymentNumber } from './paymentService.js';

const money = (value: Prisma.Decimal | number) => new Prisma.Decimal(value);

export async function createIncome(tx: Prisma.TransactionClient, input: any, userId: string) {
  if (input.categoryId) {
    const category = await tx.incomeCategory.findUnique({ where: { id: input.categoryId } });
    if (!category || category.status !== 'ACTIVE') throw Object.assign(new Error('Active income category is required.'), { statusCode: 400 });
  }
  const account = await tx.financialAccount.findUnique({ where: { id: input.accountId } });
  if (!account || account.status !== 'ACTIVE') throw Object.assign(new Error('Active financial account is required.'), { statusCode: 400 });
  const date = input.date || new Date();
  const sequence = await tx.incomeSequence.upsert({ where: { id: 1 }, update: { nextNumber: { increment: 1 } }, create: { id: 1, nextNumber: 2 } });
  const incomeNumber = 'INC-' + String(sequence.nextNumber - 1).padStart(6, '0');
  const income = await tx.otherIncome.create({ data: { incomeNumber, categoryId: input.categoryId || null, amount: money(input.amount), incomeDate: date, paymentMethod: input.paymentMethod, accountId: input.accountId, description: input.description || null, reference: input.reference || incomeNumber, notes: input.notes || null, createdBy: userId } });
  const paymentNumber = await nextPaymentNumber(tx, 'PAY');
  const payment = await tx.payment.create({ data: { paymentNumber, paymentType: 'OTHER_INCOME', type: 'OTHER_INCOME', amount: money(input.amount), method: input.paymentMethod, paymentDate: date, reference: input.reference || incomeNumber, notes: input.notes || input.description || null, accountId: input.accountId, otherIncomeId: income.id, createdBy: userId } });
  await tx.financialAccount.update({ where: { id: input.accountId }, data: { currentBalance: { increment: money(input.amount) } } });
  const transaction = await tx.transaction.create({ data: { type: 'OTHER_INCOME', amount: money(input.amount), accountId: input.accountId, paymentId: payment.id, otherIncomeId: income.id, paymentMethod: input.paymentMethod, reference: input.reference || incomeNumber, description: input.description || 'Other income', transactionDate: date, createdBy: userId } });
  return { income, payment, transaction };
}

export async function reverseIncome(tx: Prisma.TransactionClient, incomeId: string, reason: string, userId: string) {
  const income = await tx.otherIncome.findUnique({ where: { id: incomeId }, include: { payments: { where: { status: 'COMPLETED' }, take: 1 } } });
  if (!income) throw Object.assign(new Error('Income not found.'), { statusCode: 404 });
  if (income.status === 'REVERSED') throw Object.assign(new Error('Income is already reversed.'), { statusCode: 400 });
  const original = income.payments[0];
  await tx.otherIncome.update({ where: { id: incomeId }, data: { status: 'REVERSED' } });
  if (original) await tx.payment.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
  const reversalNumber = await nextPaymentNumber(tx, 'PAY');
  const payment = await tx.payment.create({ data: { paymentNumber: reversalNumber, paymentType: 'INCOME_REVERSAL', type: 'INCOME_REVERSAL', amount: income.amount, method: income.paymentMethod, paymentDate: new Date(), reference: reversalNumber, notes: reason, accountId: income.accountId, otherIncomeId: income.id, reversalOfId: original?.id, createdBy: userId } });
  await tx.financialAccount.update({ where: { id: income.accountId }, data: { currentBalance: { decrement: income.amount } } });
  const transaction = await tx.transaction.create({ data: { type: 'INCOME_REVERSAL', amount: income.amount, accountId: income.accountId, paymentId: payment.id, otherIncomeId: income.id, reference: reversalNumber, description: 'Income reversal: ' + reason, transactionDate: new Date(), createdBy: userId } });
  return { income, payment, transaction };
}
