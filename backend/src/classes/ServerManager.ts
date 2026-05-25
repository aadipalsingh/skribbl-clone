import { Server, Socket } from 'socket.io';
import { Room } from './Room';
import { Player } from './Player';

const EMOJIS = ['🐶', '🐱', '🦊', '🦁', '🐯', '🐼', '🐨', '🐻', '🐷', '🐸', '🐵', '🐔', '🐧', '🦄', '🦖'];

export class ServerManager {
  private io: Server;
  
  // Registry of all active game rooms
  private rooms: Map<string, Room> = new Map();
  
  // Lookups to resolve Player & Room instances from socket ID
  private socketPlayerMap: Map<string, Player> = new Map();
  private socketRoomMap: Map<string, Room> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Initializes all listeners on a new socket connection
   */
  public handleConnection(socket: Socket) {
    console.log(`🟢 Socket connected: ${socket.id}`);

    // 1. Create Room event
    socket.on('create_room', ({ hostName, avatar, roomId: clientRoomId, settings }, callback) => {
      // Use client-provided roomId if present, otherwise generate a unique 6-character room code
      const roomId = (clientRoomId || Math.random().toString(36).substring(2, 8).toUpperCase()).toUpperCase();
      
      const room = new Room(roomId, this.io);
      // Store settings on the room
      room.roundsSetting = settings.rounds;
      room.drawTimeSetting = settings.drawTime;
      room.maxPlayersSetting = settings.maxPlayers || 10;
      room.wordCountSetting = settings.wordCount || 3;
      room.hintsSetting = settings.hints !== undefined ? settings.hints : 2;
      room.wordModeSetting = settings.wordMode || 'Normal';
      room.roomTypeSetting = settings.roomType || 'private';
      
      this.rooms.set(roomId, room);

      // Use chosen avatar or fallback to random emoji
      const chosenAvatar = avatar || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const player = new Player(socket, hostName, chosenAvatar, true);
      
      this.socketPlayerMap.set(socket.id, player);
      this.socketRoomMap.set(socket.id, room);

      socket.join(roomId);
      room.addPlayer(player);
      
      console.log(`🏢 Created Room ${roomId} for Host: ${hostName} with Avatar: ${chosenAvatar} (Type: ${room.roomTypeSetting})`);

      // Return generated roomId to client
      if (callback) {
        callback({ roomId });
      }
    });

    // 2. Join Room event
    socket.on('join_room', ({ roomId, playerName, avatar }) => {
      const formattedRoomId = roomId.trim().toUpperCase();
      const room = this.rooms.get(formattedRoomId);

      if (!room) {
        socket.emit('chat_message', {
          playerId: 'system',
          playerName: 'System',
          text: `❌ Room ${formattedRoomId} not found.`
        });
        return;
      }

      // Enforce Max Players Cap
      if (room.players.length >= room.maxPlayersSetting) {
        socket.emit('chat_message', {
          playerId: 'system',
          playerName: 'System',
          text: `❌ Room ${formattedRoomId} is full (${room.players.length}/${room.maxPlayersSetting}).`
        });
        return;
      }

      // Use chosen avatar or fallback to random emoji
      const chosenAvatar = avatar || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const player = new Player(socket, playerName, chosenAvatar, false);

      this.socketPlayerMap.set(socket.id, player);
      this.socketRoomMap.set(socket.id, room);

      socket.join(formattedRoomId);
      room.addPlayer(player);
    });

    // 3. Quick Join Matchmaking event (Quick Match)
    socket.on('quick_join', ({ playerName, avatar }, callback) => {
      // Find an eligible active public room that is not full
      let targetRoom = Array.from(this.rooms.values()).find(room => 
        room.roomTypeSetting === 'public' && 
        room.players.length < room.maxPlayersSetting
      );

      let isNew = false;
      let roomId: string;

      if (targetRoom) {
        roomId = targetRoom.id;
        console.log(`🎮 [Matchmaker] Matched player "${playerName}" to active public room ${roomId}`);
      } else {
        // Generate a new public room if no active public rooms have space
        roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const room = new Room(roomId, this.io);
        room.roomTypeSetting = 'public';
        this.rooms.set(roomId, room);
        
        targetRoom = room;
        isNew = true;
        console.log(`🎮 [Matchmaker] No active public rooms available. Created new public room ${roomId} for "${playerName}"`);
      }

      if (callback) {
        callback({ roomId, isNew });
      }
    });

    // 3. Start Game event (Host only)
    socket.on('start_game', () => {
      const player = this.socketPlayerMap.get(socket.id);
      const room = this.socketRoomMap.get(socket.id);

      if (!player || !room || !player.isHost) return;

      room.startGame();
    });

    // 4. Word Chosen event (Drawer only)
    socket.on('word_chosen', ({ word }) => {
      const player = this.socketPlayerMap.get(socket.id);
      const room = this.socketRoomMap.get(socket.id);

      if (!player || !room || !room.game) return;

      const activeDrawerId = room.players[room.game.drawerIndex]?.id;
      if (activeDrawerId !== player.id) return;

      room.game.chooseWord(word);
    });

    // 5. Drawing Events (Mapped exactly to individual emitters)
    socket.on('draw_start', ({ x, y, color, size }) => {
      const room = this.socketRoomMap.get(socket.id);
      if (!room) return;
      socket.to(room.id).emit('draw_data', { type: 'start', x, y, color, size });
    });

    socket.on('draw_move', ({ x, y }) => {
      const room = this.socketRoomMap.get(socket.id);
      if (!room) return;
      socket.to(room.id).emit('draw_data', { type: 'move', x, y });
    });

    socket.on('draw_end', () => {
      const room = this.socketRoomMap.get(socket.id);
      if (!room) return;
      socket.to(room.id).emit('draw_data', { type: 'end' });
    });

    socket.on('canvas_clear', () => {
      const room = this.socketRoomMap.get(socket.id);
      if (!room) return;
      this.io.to(room.id).emit('draw_data', { type: 'clear' });
    });

    socket.on('draw_undo', () => {
      const room = this.socketRoomMap.get(socket.id);
      if (!room) return;
      this.io.to(room.id).emit('draw_data', { type: 'undo' });
    });

    // 6. Gameplay Guessing
    socket.on('guess', ({ text }) => {
      const player = this.socketPlayerMap.get(socket.id);
      const room = this.socketRoomMap.get(socket.id);

      if (!player || !room) return;

      if (room.game) {
        room.game.handleGuess(player, text);
      } else {
        player.socket.emit('chat_message', {
          playerId: 'system',
          playerName: 'System',
          text: '🎮 Game hasn\'t started yet.'
        });
      }
    });

    // 7. Social Chat Event
    socket.on('chat', ({ text }) => {
      const player = this.socketPlayerMap.get(socket.id);
      const room = this.socketRoomMap.get(socket.id);

      if (!player || !room) return;

      room.broadcast('chat_message', {
        playerId: player.id,
        playerName: player.name,
        text: text
      });
    });

    // 8. Disconnect
    socket.on('disconnect', () => {
      const player = this.socketPlayerMap.get(socket.id);
      const room = this.socketRoomMap.get(socket.id);

      if (!room) return;

      this.socketPlayerMap.delete(socket.id);
      this.socketRoomMap.delete(socket.id);

      const isEmpty = room.removePlayer(socket.id);
      if (isEmpty) {
        this.rooms.delete(room.id);
        console.log(`🧹 Deleted empty Room ${room.id}`);
      }
    });
  }
}
