import { z } from 'zod';

const positive = z.coerce.number().finite().positive();
export const accountActionSchema = z.object({
  partyId: z.string().min(1),
  amount: positive,
  method: z.enum(['Cash', 'Bank', 'Online Transfer', 'Cheque', 'Other']),
  date: z.coerce.date().optional(),
  reference: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  accountId: z.string().optional(),
});
export const accountSchema = z.object({ name: z.string().trim().min(2).max(100), type: z.enum(['CASH', 'BANK']), openingBalance: z.coerce.number().finite().min(0).default(0), accountNumber: z.string().trim().max(80).optional().or(z.literal('')), bankName: z.string().trim().max(100).optional().or(z.literal('')), notes: z.string().trim().max(500).optional().or(z.literal('')) });
export const paymentQuerySchema = z.object({ page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().positive().max(100).default(20), search: z.string().trim().optional().default(''), type: z.string().optional(), method: z.string().optional(), customerId: z.string().optional(), supplierId: z.string().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() });
