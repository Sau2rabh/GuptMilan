import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initSocketEvents } from './sockets';
import { connectRedis } from './services/redis';
import { connectMongoDB } from './services/db';

dotenv.config();

const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
// Allow both localhost and 127.0.0.1 variants to handle Windows IPv4/IPv6 resolution
const allowedOrigins = [
  clientUrl,
  clientUrl.replace('localhost', '127.0.0.1'),
  clientUrl.replace('127.0.0.1', 'localhost'),
];
console.log('🌍 CORS allowed origins:', allowedOrigins);

const app = express();
const httpServer = createServer(app);

// Use Helmet for security (configured to allow Socket.io/WebRTC)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabling strict CSP locally allows client connections easily
  })
);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

app.use(express.json());

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'GuptMilan API is running' });
});

async function startServer() {
  const PORT = process.env.PORT || 5000;

  // 1. Setup socket events (no external deps needed)
  initSocketEvents(io);

  // 2. Start HTTP server FIRST — always available
  httpServer.listen(PORT, () => {
    console.log(`🚀 GuptMilan server running on port ${PORT}`);
  });

  // 3. Connect to Redis in background (non-blocking)
  connectRedis().catch((err) =>
    console.warn('⚠️  Redis unavailable — matching will not work:', err?.message)
  );

  // 4. Connect to MongoDB in background (non-blocking)
  connectMongoDB().catch((err) =>
    console.warn('⚠️  MongoDB unavailable — reports will not be saved:', err?.message)
  );
}

startServer();
