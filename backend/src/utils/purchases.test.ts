import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePurchaseStatus, latestCost } from './purchases.js';
test('purchase payment status is derived correctly', () => { assert.equal(calculatePurchaseStatus(0, 0, 0), 'PAID'); assert.equal(calculatePurchaseStatus(100, 50, 0), 'PARTIAL'); assert.equal(calculatePurchaseStatus(100, 0, 0), 'CREDIT'); });
test('latest purchase cost becomes the product cost without changing historical records', () => { assert.equal(latestCost(1000, 1200), 1200); });
