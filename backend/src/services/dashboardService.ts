import { Prisma, PrismaClient } from '@prisma/client';

const n = (v: any) => Number(v || 0);
const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

export function rangeDates(start?: string, end?: string) {
  const to = end ? new Date(end) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = start ? new Date(start) : new Date(to.getFullYear(), to.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export async function buildDashboard(prisma: PrismaClient | Prisma.TransactionClient, start?: string, end?: string) {
  const { from, to } = rangeDates(start, end);
  const saleWhere = { saleDate: { gte: from, lte: to }, paymentStatus: { in: ['PAID', 'PARTIAL', 'CREDIT'] as any[] } };
  const purchaseWhere = { purchaseDate: { gte: from, lte: to } };
  const [sales, purchases, expenses, incomes, payments, customers, suppliers, products, accounts] = await Promise.all([
    prisma.sale.findMany({ where: saleWhere, include: { items: { select: { productId: true, quantity: true, total: true, costPrice: true, product: { select: { name: true, sku: true } } } }, customer: { select: { id: true, name: true } } } }),
    prisma.purchase.findMany({ where: purchaseWhere, include: { items: { select: { productId: true, quantity: true, total: true, product: { select: { name: true, sku: true } } } }, supplier: { select: { id: true, name: true } } } }),
    prisma.expense.findMany({ where: { expenseDate: { gte: from, lte: to }, status: 'COMPLETED' }, include: { category: { select: { name: true } } } }),
    prisma.otherIncome.findMany({ where: { incomeDate: { gte: from, lte: to }, status: 'COMPLETED' }, include: { category: { select: { name: true } } } }),
    prisma.payment.findMany({ where: { paymentDate: { gte: from, lte: to }, status: 'COMPLETED' }, select: { amount: true, paymentType: true, type: true, paymentDate: true } }),
    prisma.customer.findMany({ include: { ledgers: { select: { debit: true, credit: true, createdAt: true } } } }),
    prisma.supplier.findMany({ include: { ledgers: { select: { debit: true, credit: true, createdAt: true } } } }),
    prisma.product.findMany({ include: { category: { select: { name: true } } } }),
    prisma.financialAccount.findMany({ where: { status: 'ACTIVE' } }),
  ]);
  const revenue = sales.reduce((a, s) => a + n(s.total), 0);
  const cogs = sales.reduce((a, s) => a + s.items.reduce((b, i) => b + n(i.costPrice) * n(i.quantity), 0), 0);
  const expenseTotal = expenses.reduce((a, e) => a + n(e.amount), 0);
  const otherIncome = incomes.reduce((a, i) => a + n(i.amount), 0);
  const grossProfit = revenue - cogs; const netProfit = grossProfit + otherIncome - expenseTotal;
  const receivables = customers.map((c) => ({ id: c.id, name: c.name, balance: Math.max(0, c.ledgers.reduce((a, e) => a + n(e.debit) - n(e.credit), 0)), advance: n(c.advanceBalance), lastPayment: c.ledgers.filter((e) => n(e.credit) > 0).sort((a, b) => +b.createdAt - +a.createdAt)[0]?.createdAt || null })).filter((c) => c.balance > 0);
  const payables = suppliers.map((s) => ({ id: s.id, name: s.name, balance: Math.max(0, s.ledgers.reduce((a, e) => a + n(e.credit) - n(e.debit), 0)), advance: n(s.advanceBalance), lastPayment: s.ledgers.filter((e) => n(e.debit) > 0).sort((a, b) => +b.createdAt - +a.createdAt)[0]?.createdAt || null })).filter((s) => s.balance > 0);
  const expenseBreakdown = [...new Set(expenses.map((e) => e.category?.name || 'Uncategorized'))].map((category) => ({ category, amount: expenses.filter((e) => (e.category?.name || 'Uncategorized') === category).reduce((a, e) => a + n(e.amount), 0) }));
  const productsMap = new Map<string, any>(); sales.flatMap((s) => s.items).forEach((i) => { const x = productsMap.get(i.productId) || { product: i.product?.name, sku: i.product?.sku, quantity: 0, revenue: 0, cost: 0, profit: 0 }; x.quantity += n(i.quantity); x.revenue += n(i.total); x.cost += n(i.costPrice) * n(i.quantity); x.profit = x.revenue - x.cost; productsMap.set(i.productId, x); });
  const customerMap = new Map<string, any>(); sales.forEach((s) => { if (!s.customer) return; const x = customerMap.get(s.customer.id) || { customer: s.customer.name, sales: 0, orders: 0 }; x.sales += n(s.total); x.orders++; customerMap.set(s.customer.id, x); });
  const supplierMap = new Map<string, any>(); purchases.forEach((p) => { if (!p.supplier) return; const x = supplierMap.get(p.supplier.id) || { supplier: p.supplier.name, purchases: 0, orders: 0 }; x.purchases += n(p.total); x.orders++; supplierMap.set(p.supplier.id, x); });
  const daily = new Map<string, any>(); sales.forEach((s) => { const k = dateKey(s.saleDate); const x = daily.get(k) || { date: k, sales: 0, payments: 0, grossProfit: 0, expenses: 0, otherIncome: 0 }; x.sales += n(s.total); x.grossProfit += n(s.total) - s.items.reduce((a, i) => a + n(i.costPrice) * n(i.quantity), 0); daily.set(k, x); }); payments.forEach((p) => { const k = dateKey(p.paymentDate); const x = daily.get(k) || { date: k, sales: 0, payments: 0, grossProfit: 0, expenses: 0, otherIncome: 0 }; if (['CUSTOMER_PAYMENT', 'PAYMENT_RECEIVED'].includes(p.paymentType || p.type)) x.payments += n(p.amount); daily.set(k, x); }); expenses.forEach((e) => { const k = dateKey(e.expenseDate); const x = daily.get(k) || { date: k, sales: 0, payments: 0, grossProfit: 0, expenses: 0, otherIncome: 0 }; x.expenses += n(e.amount); daily.set(k, x); }); incomes.forEach((i) => { const k = dateKey(i.incomeDate); const x = daily.get(k) || { date: k, sales: 0, payments: 0, grossProfit: 0, expenses: 0, otherIncome: 0 }; x.otherIncome += n(i.amount); daily.set(k, x); });
  const moneyIn = payments.filter((p) => ['CUSTOMER_PAYMENT', 'PAYMENT_RECEIVED', 'CUSTOMER_ADVANCE', 'OTHER_INCOME'].includes(p.paymentType || p.type)).reduce((a, p) => a + n(p.amount), 0) + otherIncome;
  const moneyOut = payments.filter((p) => ['SUPPLIER_PAYMENT', 'PAYMENT_MADE', 'SUPPLIER_ADVANCE', 'OTHER_PAYMENT'].includes(p.paymentType || p.type)).reduce((a, p) => a + n(p.amount), 0) + expenseTotal;
  const inventoryValue = products.reduce((a, p) => a + n(p.currentStock) * n(p.purchasePrice), 0);
  return { from, to, sales: revenue, revenue, cogs, grossProfit, netProfit, purchases: purchases.reduce((a, p) => a + n(p.total), 0), expenses: expenseTotal, otherIncome, receivables: receivables.reduce((a, x) => a + x.balance, 0), payables: payables.reduce((a, x) => a + x.balance, 0), customerAdvances: customers.reduce((a, c) => a + n(c.advanceBalance), 0), supplierAdvances: suppliers.reduce((a, s) => a + n(s.advanceBalance), 0), cashBalance: accounts.filter((a) => a.type === 'CASH').reduce((a, x) => a + n(x.currentBalance), 0), bankBalance: accounts.filter((a) => a.type === 'BANK').reduce((a, x) => a + n(x.currentBalance), 0), inventoryValue, totalProducts: products.length, totalUnits: products.reduce((a, p) => a + n(p.currentStock), 0), lowStockProducts: products.filter((p) => n(p.currentStock) > 0 && n(p.currentStock) <= n(p.minimumStock)).length, outOfStockProducts: products.filter((p) => n(p.currentStock) <= 0).length, salesTrend: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), profitTrend: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ ...x, netProfit: x.grossProfit + x.otherIncome - x.expenses })), expenseBreakdown, topProducts: [...productsMap.values()].sort((a, b) => b.profit - a.profit).slice(0, 20), topCustomers: [...customerMap.values()].sort((a, b) => b.sales - a.sales).slice(0, 20), topSuppliers: [...supplierMap.values()].sort((a, b) => b.purchases - a.purchases).slice(0, 20), receivableCustomers: receivables.sort((a, b) => b.balance - a.balance).slice(0, 10), payableSuppliers: payables.sort((a, b) => b.balance - a.balance).slice(0, 10), cashFlow: { moneyIn, moneyOut, net: moneyIn - moneyOut }, monthlySales: monthly(sales, 'saleDate', 'total'), monthlyPurchases: monthly(purchases, 'purchaseDate', 'total') };
}

function monthly(rows: any[], dateField: string, amountField: string) { const values = new Map<string, number>(); rows.forEach((r) => { const key = monthKey(r[dateField]); values.set(key, (values.get(key) || 0) + n(r[amountField])); }); return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount })); }
