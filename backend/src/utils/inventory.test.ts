import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustedStock, getStockStatus, inventoryValue } from './inventory.js';
import { canCreateCategory, canDeactivateProduct, canManageInventory } from './permissions.js';

test('stock status detects normal, low and out-of-stock levels', () => { assert.equal(getStockStatus(20, 5), 'IN_STOCK'); assert.equal(getStockStatus(5, 5), 'LOW_STOCK'); assert.equal(getStockStatus(0, 5), 'OUT_OF_STOCK'); });
test('inventory value uses stock multiplied by purchase price', () => { assert.equal(inventoryValue(12, 2500), 30000); });
test('stock increase and decrease are calculated safely', () => { assert.equal(adjustedStock(100, 20, 'INCREASE'), 120); assert.equal(adjustedStock(100, 20, 'DECREASE'), 80); assert.throws(() => adjustedStock(10, 20, 'DECREASE'), /Insufficient stock/); });
test('role permissions match Phase 2 policy', () => { assert.equal(canManageInventory('ADMIN'), true); assert.equal(canManageInventory('MANAGER'), true); assert.equal(canManageInventory('STAFF'), false); assert.equal(canDeactivateProduct('ADMIN'), true); assert.equal(canDeactivateProduct('MANAGER'), false); assert.equal(canCreateCategory('STAFF'), false); });
