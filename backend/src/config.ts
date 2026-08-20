import 'dotenv/config';
import { z } from 'zod';

const env = z.object({ DATABASE_URL: z.string().min(1), JWT_SECRET: z.string().min(32), JWT_EXPIRES_IN: z.string().default('1d'), PORT: z.coerce.number().default(4000), FRONTEND_URL: z.string().default('http://localhost:5173') }).parse(process.env);
export default env;
