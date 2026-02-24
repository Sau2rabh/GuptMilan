'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    console.log('📡 Attempting connection to:', apiUrl);

    const socketInstance = io(apiUrl, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'], // Try WebSocket first — more reliable on Windows
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to signaling server');
      setConnected(true);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Disconnected from signaling server');
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
