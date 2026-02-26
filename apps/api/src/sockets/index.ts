import { Server, Socket } from 'socket.io';
import { MatchingService } from '../services/MatchingService';
import { Report } from '../models/Moderation';
import { redisClient } from '../services/redis';
import { isSpamming } from '../middleware/security';
import { censorMessage } from '../utils/profanityFilter';

export function initSocketEvents(io: Server) {
  io.on('connection', (socket: Socket) => {
    // ──────────────────────────────────────────────
    // MATCHING
    // ──────────────────────────────────────────────
    socket.on('find_partner', async (data: { type: 'text' | 'video'; tags: string[]; nickname?: string; location?: string }) => {
      try {
        const { type, tags, nickname, location } = data;
        const matchedSession = await MatchingService.findPartner(socket.id, type, tags, nickname, location);

        if (matchedSession && matchedSession.partnerId) {
          const partnerId = matchedSession.partnerId;
          const partnerNickname = await MatchingService.getNickname(partnerId);
          const partnerLocation = await MatchingService.getLocation(partnerId);
          const myNickname = await MatchingService.getNickname(socket.id);
          const myLocation = await MatchingService.getLocation(socket.id);

          io.to(socket.id).emit('match_found', {
            partnerId,
            partnerNickname,
            partnerLocation,
            role: 'offerer',
          });

          io.to(partnerId).emit('match_found', {
            partnerId: socket.id,
            partnerNickname: myNickname,
            partnerLocation: myLocation,
            role: 'answerer',
          });

          console.log(`✨ Match found: ${socket.id} <-> ${partnerId}`);
        } else {
          socket.emit('waiting', { message: 'Searching for a partner...' });
        }
      } catch (err) {
        console.error('Matching error:', err);
        socket.emit('error', { message: 'Failed to join matching queue' });
      }
    });

    // ──────────────────────────────────────────────
    // WEBRTC SIGNALING
    // ──────────────────────────────────────────────
    socket.on('signal_offer', (data: { to: string; offer: any }) => {
      io.to(data.to).emit('signal_offer', { from: socket.id, offer: data.offer });
    });

    socket.on('signal_answer', (data: { to: string; answer: any }) => {
      io.to(data.to).emit('signal_answer', { from: socket.id, answer: data.answer });
    });

    socket.on('signal_ice_candidate', (data: { to: string; candidate: any }) => {
      io.to(data.to).emit('signal_ice_candidate', { from: socket.id, candidate: data.candidate });
    });

    // ──────────────────────────────────────────────
    // TEXT CHAT WITH PROFANITY FILTER + SPAM CHECK
    // ──────────────────────────────────────────────
    socket.on('send_message', async (data: { content: string }) => {
      try {
        // Spam guard
        const spamming = await isSpamming(socket.id);
        if (spamming) {
          socket.emit('system_message', { content: '⚠️ You are sending messages too fast. Slow down.' });
          return;
        }

        const partnerId = await MatchingService.getPartnerId(socket.id);
        if (!partnerId) return;

        // Censor profanity before relaying
        const clean = censorMessage(data.content.trim());
        io.to(partnerId).emit('receive_message', { from: socket.id, content: clean });
      } catch (err) {
        console.error('Message error:', err);
      }
    });

    // ──────────────────────────────────────────────
    // TYPING INDICATOR
    // ──────────────────────────────────────────────
    socket.on('typing', async (isTyping: boolean) => {
      const partnerId = await MatchingService.getPartnerId(socket.id);
      if (partnerId) {
        io.to(partnerId).emit('partner_typing', isTyping);
      }
    });

    // ──────────────────────────────────────────────
    // REPORT A USER
    // ──────────────────────────────────────────────
    socket.on('report_user', async (data: { reason: string; evidence?: string }) => {
      try {
        const partnerId = await MatchingService.getPartnerId(socket.id);
        if (!partnerId) {
          socket.emit('system_message', { content: '⚠️ No active partner to report.' });
          return;
        }

        // Save report to MongoDB (fire-and-forget, don't block)
        await Report.create({
          reporterSessionId: socket.id,
          reportedSessionId: partnerId,
          reason: data.reason || 'No reason provided',
          evidence: data.evidence,
        });

        // Auto-block: mark in Redis for 24h so they can't be matched again
        const blockKey = `block:${socket.id}:${partnerId}`;
        await redisClient.set(blockKey, '1', { EX: 86400 }); // 24 hours

        socket.emit('system_message', { content: '✅ Report submitted. We will review it shortly.' });

        // Disconnect both from this session after a report
        const disconnectedPartnerId = await MatchingService.handleDisconnect(socket.id);
        if (disconnectedPartnerId) {
          io.to(disconnectedPartnerId).emit('partner_left', { from: socket.id, message: 'Session ended.' });
        }

        socket.emit('ready_for_next');
        console.log(`🚩 Report filed: ${socket.id} reported ${partnerId} for "${data.reason}"`);
      } catch (err) {
        console.error('Report error:', err);
        socket.emit('system_message', { content: '⚠️ Failed to submit report. Please try again.' });
      }
    });

    // ──────────────────────────────────────────────
    // NEXT / SKIP
    // ──────────────────────────────────────────────
    socket.on('next_partner', async () => {
      const partnerId = await MatchingService.handleDisconnect(socket.id);
      if (partnerId) {
        io.to(partnerId).emit('partner_left', { from: socket.id, message: 'Partner skipped.' });
      }
      socket.emit('ready_for_next');
    });

    // ──────────────────────────────────────────────
    // DISCONNECT
    // ──────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      const partnerId = await MatchingService.handleDisconnect(socket.id);
      if (partnerId) {
        io.to(partnerId).emit('partner_left', { from: socket.id, message: 'Partner disconnected.' });
      }
    });
  });
}
