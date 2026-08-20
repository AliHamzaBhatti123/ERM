import { z } from 'zod';

const money = z.coerce.number().finite().min(0);
const stock = z.coerce.number().finite().min(0);

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(100).optional().or(z.literal('')),
  categoryId: z.string().min(1),
  brand: z.string().trim().max(100).optional().or(z.literal('')),
  unit: z.string().trim().min(1).max(30).default('piece'),
  purchasePrice: money,
  sellingPrice: money,
  openingStock: stock.default(0),
  minimumStock: stock.default(0),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  image: z.string().trim().max(500).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const adjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().finite().positive(),
  type: z.enum(['INCREASE', 'DECREASE']),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});
