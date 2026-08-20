import { Prisma } from '@prisma/client';

const money = (value: Prisma.Decimal | number) => new Prisma.Decimal(value);

export async function createTransfer(tx: Prisma.TransactionClient, input: any, userId: string) {
  if (input.fromAccountId === input.toAccountId) throw Object.assign(new Error('Source and destination accounts must be different.'), { statusCode: 400 });
  const [from, to] = await Promise.all([tx.financialAccount.findUnique({ where: { id: input.fromAccountId } }), tx.financialAccount.findUnique({ where: { id: input.toAccountId } })]);
  if (!from || from.status !== 'ACTIVE' || !to || to.status !== 'ACTIVE') throw Object.assign(new Error('Both accounts must be active.'), { statusCode: 400 });
  if (Number(from.currentBalance) < input.amount) throw Object.assign(new Error('Insufficient account balance.'), { statusCode: 400 });
  const sequence = await tx.transferSequence.upsert({ where: { id: 1 }, update: { nextNumber: { increment: 1 } }, create: { id: 1, nextNumber: 2 } });
  const transferNumber = 'TRF-' + String(sequence.nextNumber - 1).padStart(6, '0');
  const date = input.date || new Date();
  const transfer = await tx.accountTransfer.create({ data: { transferNumber, fromAccountId: from.id, toAccountId: to.id, amount: money(input.amount), transferDate: date, reference: input.reference || transferNumber, notes: input.notes || null, createdBy: userId } });
  await tx.financialAccount.update({ where: { id: from.id }, data: { currentBalance: { decrement: money(input.amount) } } });
  await tx.financialAccount.update({ where: { id: to.id }, data: { currentBalance: { increment: money(input.amount) } } });
  await tx.transaction.create({ data: { type: 'ACCOUNT_TRANSFER_OUT', amount: money(input.amount), accountId: from.id, transferId: transfer.id, reference: input.reference || transferNumber, description: 'Transfer to ' + to.name, transactionDate: date, createdBy: userId } });
  await tx.transaction.create({ data: { type: 'ACCOUNT_TRANSFER_IN', amount: money(input.amount), accountId: to.id, transferId: transfer.id, reference: input.reference || transferNumber, description: 'Transfer from ' + from.name, transactionDate: date, createdBy: userId } });
  return transfer;
}
