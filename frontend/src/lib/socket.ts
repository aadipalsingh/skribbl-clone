import { io, Socket } from 'socket.io-client';
// Import type definitions from the shared directory
import { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Initialize the type-safe Socket.IO client instance
// In socket.io-client, the type arguments are Socket<ServerToClientEvents, ClientToServerEvents>
// because the client LISTENS to ServerToClientEvents and EMITS ClientToServerEvents
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false, // Prevent automatic connection on load; we'll connect when user joins/creates a room
  transports: ['websocket'], // Force WebSocket transport directly to avoid proxy renegotiations
});
