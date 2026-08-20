import type { NextFunction, Response } from 'express';
import { verifyToken } from '../utils/jwt.js';
import type { AuthRequest } from '../types.js';
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) { const value = req.headers.authorization; if (!value?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' }); try { req.user = verifyToken(value.slice(7)); next(); } catch { return res.status(401).json({ message: 'Invalid or expired token' }); } }
export const allowRoles = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => { if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Insufficient permissions' }); next(); };
