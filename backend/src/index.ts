import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ServerManager } from './classes/ServerManager';

const app = express();
app.use(cors());

const httpServer = createServer(app);

// Initialize standard Socket.IO server with CORS options
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Instantiate the Object-Oriented ServerManager to handle connections
const serverManager = new ServerManager(io);

io.on('connection', (socket) => {
  serverManager.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 OOP WebSocket Server running on port ${PORT}`);
});
