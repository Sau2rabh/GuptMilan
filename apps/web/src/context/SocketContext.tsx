'use client';

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketContext } from './SocketContextInstance';

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (socketRef.current) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    console.log('📡 Initializing socket connection for HMR stability:', apiUrl);

    const socketInstance = io(apiUrl, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('✅ Connected to signaling server with ID:', socketInstance.id, 'Transport:', socketInstance.io.engine.transport.name);
      setConnected(true);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Disconnected from signaling server. Reason:', reason);
      setConnected(false);
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    setSocket(socketInstance);

    return () => {
      if (socketRef.current) {
        console.log('🧹 Cleaning up socket connection:', socketRef.current.id);
        socketRef.current.off('connect');
        socketRef.current.off('connect_error');
        socketRef.current.off('disconnect');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
