import { redisClient } from './redis';
import { v4 as uuidv4 } from 'uuid';

export interface UserSession {
  socketId: string;
  sessionId: string;
  type: 'text' | 'video';
  tags: string[];
  status: 'waiting' | 'chatting';
  partnerId: string | null;
  nickname?: string;
}

export class MatchingService {
  private static readonly QUEUE_PREFIX = 'queue';
  private static readonly SESSION_PREFIX = 'session';

  /**
   * Adds a user to the matching queue and attempts to find a partner.
   */
  static async findPartner(socketId: string, type: 'text' | 'video', tags: string[], nickname: string = 'Stranger'): Promise<UserSession | null> {
    const sessionId = uuidv4();
    const session: UserSession = {
      socketId,
      sessionId,
      type,
      tags,
      status: 'waiting',
      partnerId: null,
    };

    // Save session in Redis
    await redisClient.hSet(`${this.SESSION_PREFIX}:${socketId}`, {
      sessionId,
      type,
      tags: JSON.stringify(tags),
      status: 'waiting',
      partnerId: '',
      nickname,
    });

    // If tags are provided, strictly match by tags
    if (tags.length > 0) {
      for (const tag of tags) {
        const sanitizedTag = tag.toLowerCase().trim();
        if (!sanitizedTag) continue;

        const queueKey = `${this.QUEUE_PREFIX}:${type}:${sanitizedTag}`;
        const partnerSocketId = await redisClient.sPop(queueKey);

        if (partnerSocketId && partnerSocketId !== socketId) {
          const partnerActive = await this.isUserWaiting(partnerSocketId);
          if (partnerActive) {
            return this.matchUsers(socketId, partnerSocketId, session);
          }
        }
      }
      
      // No tag match found, add user to tag queues only
      await Promise.all(
        tags.map(tag => redisClient.sAdd(`${this.QUEUE_PREFIX}:${type}:${tag.toLowerCase().trim()}`, socketId))
      );
    } else {
      // No tags provided, use global queue
      const globalQueueKey = `${this.QUEUE_PREFIX}:${type}:global`;
      const randomPartnerId = await redisClient.sPop(globalQueueKey);

      if (randomPartnerId && randomPartnerId !== socketId) {
        const partnerActive = await this.isUserWaiting(randomPartnerId);
        if (partnerActive) {
          return this.matchUsers(socketId, randomPartnerId, session);
        }
      }

      // No match found, add to global queue
      await redisClient.sAdd(globalQueueKey, socketId);
    }

    return null;
  }

  private static async isUserWaiting(socketId: string): Promise<boolean> {
    const status = await redisClient.hGet(`${this.SESSION_PREFIX}:${socketId}`, 'status');
    return status === 'waiting';
  }

  private static async matchUsers(socketId1: string, socketId2: string, session1: UserSession): Promise<UserSession> {
    // Update both sessions in Redis
    await Promise.all([
      redisClient.hSet(`${this.SESSION_PREFIX}:${socketId1}`, {
        status: 'chatting',
        partnerId: socketId2
      }),
      redisClient.hSet(`${this.SESSION_PREFIX}:${socketId2}`, {
        status: 'chatting',
        partnerId: socketId1
      })
    ]);

    return {
      ...session1,
      status: 'chatting',
      partnerId: socketId2
    };
  }

  /**
   * Cleans up a user's session and removes them from queues on disconnect.
   */
  static async handleDisconnect(socketId: string) {
    const sessionData = await redisClient.hGetAll(`${this.SESSION_PREFIX}:${socketId}`);
    if (!sessionData || Object.keys(sessionData).length === 0) return null;

    const type = sessionData.type;
    const tags = JSON.parse(sessionData.tags || '[]') as string[];
    const partnerId = sessionData.partnerId;

    // Remove from queues
    const jobs = [
      ...tags.map(tag => redisClient.sRem(`${this.QUEUE_PREFIX}:${type}:${tag.toLowerCase().trim()}`, socketId)),
      redisClient.sRem(`${this.QUEUE_PREFIX}:${type}:global`, socketId),
      redisClient.del(`${this.SESSION_PREFIX}:${socketId}`)
    ];

    await Promise.all(jobs);
    
    return partnerId || null;
  }

  static async getPartnerId(socketId: string): Promise<string | null> {
    return await redisClient.hGet(`${this.SESSION_PREFIX}:${socketId}`, 'partnerId');
  }

  static async getNickname(socketId: string): Promise<string> {
    return (await redisClient.hGet(`${this.SESSION_PREFIX}:${socketId}`, 'nickname')) || 'Stranger';
  }
}
