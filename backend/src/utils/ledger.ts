export type LedgerEntry = { debit: number; credit: number; balance: number };
export function nextLedgerBalance(previous: number, debit: number, credit: number, party: 'CUSTOMER' | 'SUPPLIER') { return party === 'CUSTOMER' ? previous + debit - credit : previous + credit - debit; }
export function customerReceivable(entries: LedgerEntry[]) { return Math.max(0, entries.reduce((sum, entry) => sum + entry.debit - entry.credit, 0)); }
export function supplierPayable(entries: LedgerEntry[]) { return Math.max(0, entries.reduce((sum, entry) => sum + entry.credit - entry.debit, 0)); }
