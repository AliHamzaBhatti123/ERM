export function calculatePaymentStatus(remaining: number, paid: number, advance: number) { return remaining <= 0 ? 'PAID' : paid + advance > 0 ? 'PARTIAL' : 'CREDIT'; }
export function calculateProfit(sellingTotal: number, costTotal: number) { return sellingTotal - costTotal; }
