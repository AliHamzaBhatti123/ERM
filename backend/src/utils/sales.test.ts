import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentStatus, calculateProfit } from './sales.js';
test('sale payment status is derived from remaining and applied payment', () => { assert.equal(calculatePaymentStatus(0, 0, 0), 'PAID'); assert.equal(calculatePaymentStatus(100, 50, 0), 'PARTIAL'); assert.equal(calculatePaymentStatus(100, 0, 0), 'CREDIT'); });
test('profit uses captured sale cost', () => { assert.equal(calculateProfit(15000, 10000), 5000); });
