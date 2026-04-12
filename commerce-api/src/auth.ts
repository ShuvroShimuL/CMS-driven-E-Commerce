import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const ACCESS_SECRET  = process.env.JWT_SECRET         || 'dev-access-secret-change-in-prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod';

export interface JWTPayload { id: number; email: string; }

export function signAccessToken(userId: number, email: string): string {
  return jwt.sign({ id: userId, email }, ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(userId: number, email: string): string {
  return jwt.sign({ id: userId, email }, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, ACCESS_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, REFRESH_SECRET) as JWTPayload;
}

/** SHA-256 hash a raw token before storing in DB */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Express middleware: validates Bearer access token and attaches req.user */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Access token invalid or expired' });
  }
}
