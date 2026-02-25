'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

interface WebRTCOptions {
  type: 'text' | 'video';
  nickname?: string;
  onPartnerLeft?: () => void;
  onMatchFound?: (partnerId: string, partnerNickname: string) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

// Add TURN server if provided in environment variables
if (process.env.NEXT_PUBLIC_TURN_URL) {
  ICE_SERVERS.push({
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME,
    credential: process.env.NEXT_PUBLIC_TURN_PASSWORD,
  });
}

export const useWebRTC = ({ type, nickname = 'Stranger', onPartnerLeft, onMatchFound }: WebRTCOptions) => {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localStreamPromiseRef = useRef<Promise<MediaStream> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lastTagsRef = useRef<string[]>([]);
  const onMatchFoundRef = useRef(onMatchFound);
  const onPartnerLeftRef = useRef(onPartnerLeft);

  useEffect(() => {
    onMatchFoundRef.current = onMatchFound;
    onPartnerLeftRef.current = onPartnerLeft;
  }, [onMatchFound, onPartnerLeft]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    setPartnerId(null);
    pendingCandidatesRef.current = [];
  }, []);

  const createPeerConnection = useCallback((toPartnerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('signal_ice_candidate', { to: toPartnerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        // Fallback for browsers that don't provide streams in the event
        const stream = new MediaStream();
        stream.addTrack(event.track);
        setRemoteStream(stream);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    if (type === 'video' && !localStreamPromiseRef.current) {
      localStreamPromiseRef.current = navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setLocalStream(stream);
          localStreamRef.current = stream;
          return stream;
        })
        .catch(err => {
          console.error('Error accessing media:', err);
          throw err;
        });
    }

    socket.on('match_found', async ({ partnerId: pId, partnerNickname, role }) => {
      setIsMatching(false);
      setPartnerId(pId);
      onMatchFoundRef.current?.(pId, partnerNickname || 'Stranger');

      // Ensure local stream is ready before creating peer connection
      if (type === 'video' && localStreamPromiseRef.current) {
        try {
          await localStreamPromiseRef.current;
        } catch (err) {
          console.error('Cannot proceed with match: media failed', err);
          return;
        }
      }

      const pc = createPeerConnection(pId);

      if (role === 'offerer') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal_offer', { to: pId, offer });
      }
    });

    socket.on('signal_offer', async ({ from, offer }) => {
      // Ensure local stream is ready
      if (type === 'video' && localStreamPromiseRef.current) {
        try { await localStreamPromiseRef.current; } catch (err) { return; }
      }

      const pc = pcRef.current || createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Process any pending candidates
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal_answer', { to: from, answer });
    });

    socket.on('signal_answer', async ({ answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process any pending candidates
        while (pendingCandidatesRef.current.length > 0) {
          const candidate = pendingCandidatesRef.current.shift();
          if (candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    });

    socket.on('signal_ice_candidate', async ({ candidate }) => {
      if (pcRef.current && pcRef.current.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    });

    socket.on('partner_left', () => {
      cleanup();
      onPartnerLeftRef.current?.();
    });

    return () => {
      socket.off('match_found');
      socket.off('signal_offer');
      socket.off('signal_answer');
      socket.off('signal_ice_candidate');
      socket.off('partner_left');
      cleanup();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [socket, type, createPeerConnection, cleanup]);

  const findPartner = (tags: string[]) => {
    if (!socket) return;
    lastTagsRef.current = tags;
    cleanup();
    setIsMatching(true);
    socket.emit('find_partner', { type, tags, nickname });
  };

  const nextPartner = useCallback(() => {
    if (!socket) return;
    socket.emit('next_partner');
    cleanup();
    setIsMatching(true);
    socket.emit('find_partner', { type, tags: lastTagsRef.current, nickname });
  }, [socket, cleanup, type, nickname]);

  return { localStream, remoteStream, isMatching, partnerId, findPartner, nextPartner };
};
