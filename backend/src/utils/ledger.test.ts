import test from 'node:test';
import assert from 'node:assert/strict';
import { customerReceivable, nextLedgerBalance, supplierPayable } from './ledger.js';

test('customer running balance uses debit minus credit', () => { assert.equal(nextLedgerBalance(50000, 20000, 0, 'CUSTOMER'), 70000); assert.equal(nextLedgerBalance(70000, 0, 30000, 'CUSTOMER'), 40000); assert.equal(customerReceivable([{ debit: 50000, credit: 0, balance: 50000 }, { debit: 0, credit: 30000, balance: 20000 }]), 20000); });
test('supplier running balance uses credit minus debit', () => { assert.equal(nextLedgerBalance(80000, 0, 30000, 'SUPPLIER'), 110000); assert.equal(nextLedgerBalance(110000, 40000, 0, 'SUPPLIER'), 70000); assert.equal(supplierPayable([{ debit: 0, credit: 80000, balance: 80000 }, { debit: 40000, credit: 0, balance: 40000 }]), 40000); });
