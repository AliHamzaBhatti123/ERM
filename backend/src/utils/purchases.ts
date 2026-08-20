// Phase 5 intentionally stores the latest incoming cost on Product. SaleItems
// snapshot costPrice, so historical profit remains stable for future costing.
export function calculatePurchaseStatus(remaining: number, paid: number, advance: number) { return remaining <= 0 ? 'PAID' : paid + advance > 0 ? 'PARTIAL' : 'CREDIT'; }
export function latestCost(previous: number, incoming: number) { return incoming; }
