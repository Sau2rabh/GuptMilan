import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../services/redis';
import crypto from 'crypto';

/**
 * Simple rate limiter using Redis
 */
export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const hash = crypto.createHash('sha256').update(ip).digest('hex');
  const key = `ratelimit:api:${hash}`;

  try {
    const requests = await redisClient.incr(key);
    if (requests === 1) {
      await redisClient.expire(key, 60); // 1 minute window
    }

    if (requests > 60) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  } catch (err) {
    next();
  }
}

/**
 * Spam detection for Socket.io
 */
export async function isSpamming(socketId: string): Promise<boolean> {
  const key = `ratelimit:socket:${socketId}`;
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, 10); // 10 second window
  }
  return count > 15; // Max 15 messages per 10 seconds
}
