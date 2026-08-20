import { z } from 'zod';
const password = z.string().min(8).regex(/[A-Z]/, 'Password must include an uppercase letter').regex(/[a-z]/, 'Password must include a lowercase letter').regex(/[0-9]/, 'Password must include a number');
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
export const createUserSchema = z.object({ name: z.string().min(2), email: z.string().email(), password, role: z.enum(['ADMIN','MANAGER','STAFF']).default('STAFF') });
