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
  }, []);

  const createPeerConnection = useCallback((toPartnerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('signal_ice_candidate', { to: toPartnerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
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

    if (type === 'video') {
       navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setLocalStream(stream);
          localStreamRef.current = stream;
        })
        .catch(err => console.error('Error accessing media:', err));
    }

    socket.on('match_found', async ({ partnerId: pId, partnerNickname, role }) => {
      setIsMatching(false);
      setPartnerId(pId);
      onMatchFoundRef.current?.(pId, partnerNickname || 'Stranger');

      const pc = createPeerConnection(pId);

      if (role === 'offerer') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal_offer', { to: pId, offer });
      }
    });

    socket.on('signal_offer', async ({ from, offer }) => {
      const pc = pcRef.current || createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal_answer', { to: from, answer });
    });

    socket.on('signal_answer', async ({ answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('signal_ice_candidate', async ({ candidate }) => {
      if (pcRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
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
    cleanup();
    setIsMatching(true);
    socket.emit('find_partner', { type, tags, nickname });
  };

  const nextPartner = () => {
    if (!socket) return;
    socket.emit('next_partner');
    cleanup();
    setIsMatching(true);
  };

  return { localStream, remoteStream, isMatching, partnerId, findPartner, nextPartner };
};
