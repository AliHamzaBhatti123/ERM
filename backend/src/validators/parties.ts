import { z } from 'zod';

const optionalEmail = z.string().trim().email().optional().or(z.literal(''));
const balance = z.coerce.number().finite().min(0);
const base = { name: z.string().trim().min(1).max(160), phone: z.string().trim().max(40).optional().or(z.literal('')), email: optionalEmail, address: z.string().trim().max(300).optional().or(z.literal('')), city: z.string().trim().max(80).optional().or(z.literal('')), notes: z.string().trim().max(2000).optional().or(z.literal('')), openingBalance: balance.default(0) };
export const customerSchema = z.object({ customerCode: z.string().trim().min(1).max(40), ...base, openingBalanceType: z.enum(['RECEIVABLE', 'ADVANCE', 'NONE']).default('NONE') });
export const supplierSchema = z.object({ supplierCode: z.string().trim().min(1).max(40), ...base, openingBalanceType: z.enum(['PAYABLE', 'ADVANCE', 'NONE']).default('NONE') });
export const financialActionSchema = z.object({ amount: z.coerce.number().finite().positive(), date: z.coerce.date().optional(), method: z.string().trim().min(1).max(40), reference: z.string().trim().max(120).optional().or(z.literal('')), notes: z.string().trim().max(500).optional().or(z.literal('')) });
