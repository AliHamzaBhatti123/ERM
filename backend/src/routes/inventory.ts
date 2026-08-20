import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import type { AuthRequest } from '../types.js';
import { adjustmentSchema, categorySchema, productSchema } from '../validators/inventory.js';

const router = Router();
const managementRoles = ['ADMIN', 'MANAGER'];
const writeRoles = ['ADMIN', 'MANAGER'];
const decimal = (value: number) => new Prisma.Decimal(value);
const productSelect = { category: true } as const;

function statusFor(stock: Prisma.Decimal | number, minimum: Prisma.Decimal | number) {
  const current = Number(stock);
  const min = Number(minimum);
  return current <= 0 ? 'OUT_OF_STOCK' : current <= min ? 'LOW_STOCK' : 'IN_STOCK';
}

function productDto(product: any) {
  return { ...product, purchasePrice: product.purchasePrice.toString(), sellingPrice: product.sellingPrice.toString(), currentStock: product.currentStock.toString(), minimumStock: product.minimumStock.toString(), stockStatus: statusFor(product.currentStock, product.minimumStock) };
}

router.get('/categories', requireAuth, async (_req, res, next) => { try { const categories = await prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }); res.json({ categories }); } catch (error) { next(error); } });

router.post('/categories', requireAuth, allowRoles(...managementRoles), async (req, res, next) => { try { const input = categorySchema.parse(req.body); const category = await prisma.category.create({ data: input }); res.status(201).json({ category }); } catch (error) { next(error); } });

router.put('/categories/:id', requireAuth, allowRoles(...managementRoles), async (req, res, next) => { try { const input = categorySchema.partial().parse(req.body); const category = await prisma.category.update({ where: { id: String(req.params.id) }, data: input }); res.json({ category }); } catch (error) { next(error); } });

router.delete('/categories/:id', requireAuth, allowRoles('ADMIN'), async (req, res, next) => { try { const id = String(req.params.id); const activeProducts = await prisma.product.count({ where: { categoryId: id, status: 'ACTIVE' } }); if (activeProducts > 0) return res.status(409).json({ message: 'Cannot delete a category with active products. Move products to another category first.' }); const category = await prisma.category.update({ where: { id }, data: { status: 'INACTIVE' } }); res.json({ category, message: 'Category deactivated' }); } catch (error) { next(error); } });

router.get('/products', requireAuth, async (req, res, next) => { try {
  const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
  const search = String(req.query.search || '').trim(); const categoryId = String(req.query.categoryId || '').trim(); const status = String(req.query.status || '').trim(); const stockStatus = String(req.query.stockStatus || '').trim();
  const where: Prisma.ProductWhereInput = { ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search, mode: 'insensitive' } }] } : {}), ...(categoryId ? { categoryId } : {}), ...(status === 'ACTIVE' || status === 'INACTIVE' ? { status: status as any } : {}), ...(stockStatus === 'OUT_OF_STOCK' ? { currentStock: { lte: 0 } } : stockStatus === 'LOW_STOCK' ? { currentStock: { gt: 0 } } : {}) };
  const sortField = ['name', 'sku', 'currentStock', 'sellingPrice', 'createdAt'].includes(String(req.query.sort)) ? String(req.query.sort) : 'createdAt'; const sortOrder = req.query.order === 'asc' ? 'asc' : 'desc';
  const [products, total] = await prisma.$transaction([prisma.product.findMany({ where, include: productSelect, orderBy: { [sortField]: sortOrder }, skip: (page - 1) * pageSize, take: pageSize }), prisma.product.count({ where })]);
  const filtered = stockStatus === 'LOW_STOCK' ? products.filter((p) => Number(p.currentStock) > 0 && Number(p.currentStock) <= Number(p.minimumStock)) : products;
  res.json({ products: filtered.map(productDto), pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
} catch (error) { next(error); } });

router.get('/products/:id', requireAuth, async (req, res, next) => { try { const product = await prisma.product.findUnique({ where: { id: String(req.params.id) }, include: { category: true, inventoryTransactions: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } } } }); if (!product) return res.status(404).json({ message: 'Product not found' }); res.json({ product: productDto(product) }); } catch (error) { next(error); } });

router.post('/products', requireAuth, allowRoles(...writeRoles), async (req: AuthRequest, res, next) => { try { const input = productSchema.parse(req.body); const product = await prisma.$transaction(async (tx) => { const created = await tx.product.create({ data: { name: input.name, sku: input.sku, barcode: input.barcode || null, categoryId: input.categoryId, brand: input.brand || null, unit: input.unit, purchasePrice: decimal(input.purchasePrice), sellingPrice: decimal(input.sellingPrice), currentStock: decimal(input.openingStock), minimumStock: decimal(input.minimumStock), description: input.description || null, image: input.image || null, status: input.status }, include: { category: true } }); if (input.openingStock > 0) await tx.inventoryTransaction.create({ data: { productId: created.id, type: 'STOCK_IN', quantity: decimal(input.openingStock), previousStock: decimal(0), newStock: decimal(input.openingStock), referenceType: 'OPENING_STOCK', note: 'Opening stock', createdBy: req.user!.id } }); return created; }); res.status(201).json({ product: productDto(product) }); } catch (error) { next(error); } });

router.put('/products/:id', requireAuth, allowRoles(...writeRoles), async (req, res, next) => { try { const input = productSchema.omit({ openingStock: true }).partial().parse(req.body); const product = await prisma.product.update({ where: { id: String(req.params.id) }, data: { ...input, barcode: input.barcode || null, purchasePrice: input.purchasePrice === undefined ? undefined : decimal(input.purchasePrice), sellingPrice: input.sellingPrice === undefined ? undefined : decimal(input.sellingPrice), description: input.description || null, image: input.image || null, brand: input.brand || null }, include: { category: true } }); res.json({ product: productDto(product) }); } catch (error) { next(error); } });

router.delete('/products/:id', requireAuth, allowRoles('ADMIN'), async (req, res, next) => { try { const id = String(req.params.id); const history = await prisma.inventoryTransaction.count({ where: { productId: id } }); const product = await prisma.product.update({ where: { id }, data: { status: 'INACTIVE' }, include: { category: true } }); res.json({ product: productDto(product), message: history ? 'Product deactivated to preserve inventory history' : 'Product deactivated' }); } catch (error) { next(error); } });

router.get('/inventory', requireAuth, async (_req, res, next) => { try { const products = await prisma.product.findMany({ where: { status: 'ACTIVE' }, include: { category: true }, orderBy: { name: 'asc' } }); res.json({ inventory: products.map((p) => ({ ...productDto(p), inventoryValue: new Prisma.Decimal(p.currentStock).mul(p.purchasePrice).toString() })) }); } catch (error) { next(error); } });
router.get('/inventory/low-stock', requireAuth, async (_req, res, next) => { try { const products = await prisma.product.findMany({ where: { status: 'ACTIVE', currentStock: { gt: 0 } }, include: { category: true } }); res.json({ products: products.filter((p) => Number(p.currentStock) <= Number(p.minimumStock)).map(productDto) }); } catch (error) { next(error); } });
router.get('/inventory/out-of-stock', requireAuth, async (_req, res, next) => { try { const products = await prisma.product.findMany({ where: { status: 'ACTIVE', currentStock: { lte: 0 } }, include: { category: true } }); res.json({ products: products.map(productDto) }); } catch (error) { next(error); } });
router.get('/inventory/:productId/history', requireAuth, async (req, res, next) => { try { const history = await prisma.inventoryTransaction.findMany({ where: { productId: String(req.params.productId) }, include: { user: { select: { id: true, name: true, email: true } }, product: { select: { name: true, sku: true } } }, orderBy: { createdAt: 'desc' } }); res.json({ history }); } catch (error) { next(error); } });

router.post('/inventory/adjust', requireAuth, allowRoles(...writeRoles), async (req: AuthRequest, res, next) => { try { const input = adjustmentSchema.parse(req.body); const result = await prisma.$transaction(async (tx) => { const product = await tx.product.findUnique({ where: { id: input.productId } }); if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 }); const previous = Number(product.currentStock); const nextStock = input.type === 'INCREASE' ? previous + input.quantity : previous - input.quantity; if (nextStock < 0) throw Object.assign(new Error(`Insufficient stock. Available stock is ${previous}.`), { statusCode: 400 }); const updated = await tx.product.update({ where: { id: product.id }, data: { currentStock: decimal(nextStock) }, include: { category: true } }); const transaction = await tx.inventoryTransaction.create({ data: { productId: product.id, type: input.type === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantity: decimal(input.quantity), previousStock: decimal(previous), newStock: decimal(nextStock), referenceType: 'ADJUSTMENT', note: input.note || null, createdBy: req.user!.id } }); return { product: updated, transaction }; }); res.json({ product: productDto(result.product), transaction: result.transaction }); } catch (error) { next(error); } });

export default router;
