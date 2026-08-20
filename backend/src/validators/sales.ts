import { z } from 'zod';

const nonNegative = z.coerce.number().finite().min(0);
export const saleSchema = z.object({
  customerId: z.string().min(1).nullable().optional(),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().finite().positive(), unitPrice: nonNegative.optional(), discount: nonNegative.default(0), tax: nonNegative.default(0) })).min(1),
  discount: nonNegative.default(0),
  tax: nonNegative.default(0),
  paidAmount: nonNegative.default(0),
  advanceUsed: nonNegative.default(0),
  paymentMethod: z.string().trim().max(40).optional().or(z.literal('')),
  saleDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export const salesQuerySchema = z.object({ page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().positive().max(100).default(10), search: z.string().trim().optional().default(''), paymentStatus: z.enum(['PAID', 'PARTIAL', 'CREDIT']).optional(), customerId: z.string().optional(), sort: z.enum(['saleDate', 'invoiceNumber', 'total', 'createdAt']).default('saleDate'), order: z.enum(['asc', 'desc']).default('desc') });
