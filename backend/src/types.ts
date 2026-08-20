import type { Role } from '@prisma/client';
import type { Request } from 'express';
export type AuthUser = { id: string; email: string; role: Role; name: string };
export type AuthRequest = Request & { user?: AuthUser };
