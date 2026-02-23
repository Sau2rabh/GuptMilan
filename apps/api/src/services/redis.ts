import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
});

let redisErrorLogged = false;
redisClient.on('error', (err) => {
  if (!redisErrorLogged) {
    console.warn('⚠️  Redis not available (matching disabled):', err.code);
    redisErrorLogged = true;
  }
});
redisClient.on('connect', () => {
  redisErrorLogged = false;
  console.log('✅ Connected to Redis');
});

export async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️  Could not connect to Redis. Matching queue requires Redis.');
  }
}
