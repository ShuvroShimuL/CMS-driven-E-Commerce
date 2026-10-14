import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

function secret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

export interface JWTPayload { id: number; email: string; }

export function signAccessToken(userId: number, email: string): string {
  return jwt.sign({ id: userId, email }, secret('JWT_SECRET'), { expiresIn: '15m', algorithm: 'HS256' });
}

export function signRefreshToken(userId: number, email: string): string {
  return jwt.sign({ id: userId, email }, secret('JWT_REFRESH_SECRET'), { expiresIn: '7d', algorithm: 'HS256', jwtid: crypto.randomUUID() });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, secret('JWT_SECRET'), { algorithms: ['HS256'] }) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, secret('JWT_REFRESH_SECRET'), { algorithms: ['HS256'] }) as JWTPayload;
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
