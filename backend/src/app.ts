import express from 'express';
import cors from 'cors';
import env from './config.js';
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import partyRoutes from './routes/parties.js';
import salesRoutes from './routes/sales.js';
import purchaseRoutes from './routes/purchases.js';
import accountRoutes from './routes/accounts.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
export const app = express();
app.use(cors({ origin: [env.FRONTEND_URL, 'http://localhost:4173', 'http://127.0.0.1:4173', 'http://127.0.0.1:5173'] }));
app.use(express.json());
app.get('/api/health', (_req,res) => res.json({ status:'ok', service:'erm-api' }));
app.use('/api/auth', authRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', partyRoutes);
app.use('/api', salesRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', accountRoutes);
app.use('/api', expenseRoutes);
app.use('/api', reportRoutes);
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ success: false, message: 'Validation failed', code: 'VALIDATION_ERROR', errors: err.flatten().fieldErrors });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'A record with this unique value already exists.', code: 'DUPLICATE_RECORD' });
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Record not found', code: 'NOT_FOUND' });
  }
  const status = typeof err === 'object' && err && 'statusCode' in err && typeof (err as { statusCode?: unknown }).statusCode === 'number' ? (err as { statusCode: number }).statusCode : 500;
  res.status(status).json({ success: false, message: status >= 500 ? 'Something went wrong. Please try again.' : err instanceof Error ? err.message : 'Request failed', code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR' });
});
