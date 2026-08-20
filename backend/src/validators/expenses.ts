import { z } from 'zod';

const positive = z.coerce.number().finite().positive();
const common = { amount: positive, date: z.coerce.date().optional(), paymentMethod: z.enum(['Cash', 'Bank', 'Online Transfer', 'Cheque', 'Other']), accountId: z.string().min(1), reference: z.string().trim().max(120).optional().or(z.literal('')), description: z.string().trim().max(500).optional().or(z.literal('')), notes: z.string().trim().max(1000).optional().or(z.literal('')) };
export const expenseSchema = z.object({ categoryId: z.string().min(1), ...common });
export const incomeSchema = z.object({ categoryId: z.string().optional().or(z.literal('')), ...common });
export const categorySchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional().or(z.literal('')) });
export const listSchema = z.object({ page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().positive().max(100).default(20), search: z.string().trim().optional().default(''), categoryId: z.string().optional(), accountId: z.string().optional(), paymentMethod: z.string().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() });
export const reversalSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const transferSchema = z.object({ fromAccountId: z.string().min(1), toAccountId: z.string().min(1), amount: positive, date: z.coerce.date().optional(), reference: z.string().trim().max(120).optional().or(z.literal('')), notes: z.string().trim().max(1000).optional().or(z.literal('')) });
