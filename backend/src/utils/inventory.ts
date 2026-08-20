export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export function getStockStatus(stock: number, minimum: number): StockStatus { return stock <= 0 ? 'OUT_OF_STOCK' : stock <= minimum ? 'LOW_STOCK' : 'IN_STOCK'; }
export function inventoryValue(stock: number, purchasePrice: number): number { return stock * purchasePrice; }
export function adjustedStock(current: number, quantity: number, type: 'INCREASE' | 'DECREASE'): number { const next = type === 'INCREASE' ? current + quantity : current - quantity; if (next < 0) throw new Error(`Insufficient stock. Available stock is ${current}.`); return next; }
