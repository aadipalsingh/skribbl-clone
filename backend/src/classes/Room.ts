import { Server } from 'socket.io';
import { Player } from './Player';
import { Game } from './Game';

export class Room {
  public id: string;
  public players: Player[] = [];
  public game: Game | null = null;
  private io: Server;

  // Host configuration variables
  public roundsSetting: number = 3;
  public drawTimeSetting: number = 60;
  public maxPlayersSetting: number = 10;
  public wordCountSetting: number = 3;
  public hintsSetting: number = 2;
  public wordModeSetting: string = 'Normal';
  public roomTypeSetting: 'public' | 'private' = 'private';

  constructor(roomId: string, io: Server) {
    this.id = roomId;
    this.io = io;
  }

  public addPlayer(player: Player) {
    if (this.players.length === 0) {
      player.isHost = true;
    }

    this.players.push(player);
    console.log(`🚪 [Lobby ${this.id}] Added player ${player.name} (Host: ${player.isHost})`);

    // 1. Broadcast updated player list to other players already in the room
    this.broadcastPlayerList();

    // 2. Direct Confirmation: Send player list directly to this player's socket immediately.
    // This completely bypasses any Socket.IO async room-joining race conditions!
    player.socket.emit('player_joined', {
      player: player.toJSON(),
      players: this.players.map(p => p.toJSON()),
      settings: {
        rounds: this.roundsSetting,
        drawTime: this.drawTimeSetting,
        maxPlayers: this.maxPlayersSetting,
        wordCount: this.wordCountSetting,
        hints: this.hintsSetting,
        wordMode: this.wordModeSetting,
        roomType: this.roomTypeSetting
      }
    });

    // If a game is active, sync the game state to the joining player instantly
    if (this.game) {
      this.game.broadcastState();
    }
  }

  /**
   * Removes a player from the room
   * Returns true if room is now empty and should be cleaned up.
   */
  public removePlayer(playerId: string): boolean {
    const leavingPlayer = this.players.find(p => p.id === playerId);
    this.players = this.players.filter(p => p.id !== playerId);

    console.log(`🚪 [Lobby ${this.id}] Removed player ${leavingPlayer?.name || playerId}`);

    if (this.players.length === 0) {
      this.destroy();
      return true;
    }

    // Host left: immediately destroy the room and notify other players
    if (leavingPlayer?.isHost) {
      console.log(`👑 [Lobby ${this.id}] Host ${leavingPlayer.name} has left. Destroying room.`);
      
      this.broadcast('chat_message', {
        playerId: 'system_error',
        playerName: 'System',
        text: `👑 Host ${leavingPlayer.name} has left. This room is destroyed!`
      });

      this.broadcast('room_destroyed', {
        reason: `Host ${leavingPlayer.name} left the room.`
      });

      this.destroy();
      return true;
    }

    // Normal player left: notify remaining players in chat
    if (leavingPlayer) {
      this.broadcast('chat_message', {
        playerId: 'system',
        playerName: 'System',
        text: `🚪 ${leavingPlayer.name} has left the room.`
      });
    }

    this.broadcastPlayerList();

    if (this.game) {
      const drawer = this.players[this.game.drawerIndex];
      if (!drawer || drawer.id === playerId) {
        console.log(`🎨 [Lobby ${this.id}] Active drawer disconnected. Ending round.`);
        this.game.endRound();
      } else {
        this.game.broadcastState();
      }
    }

    return false;
  }

  /**
   * Instantiates and starts the active gameplay loop
   */
  public startGame() {
    if (this.game) return;
    if (this.players.length < 2) {
      console.log(`⚠️ [Lobby ${this.id}] Cannot start game: Not enough players (${this.players.length}/2).`);
      return;
    }

    // Dynamically feed the host's settings into the game instance!
    this.game = new Game(
      this,
      this.roundsSetting,
      this.drawTimeSetting,
      this.wordCountSetting,
      this.hintsSetting,
      this.wordModeSetting
    );
    this.game.start();

    console.log(`🚀 [Lobby ${this.id}] Game started with ${this.roundsSetting} rounds, ${this.drawTimeSetting}s draw time, mode ${this.wordModeSetting}.`);
  }

  /**
   * Broadcast utility
   */
  public broadcast(event: string, payload: any) {
    this.io.to(this.id).emit(event, payload);
  }

  /**
   * Syncs the player list across clients inside the room
   */
  private broadcastPlayerList() {
    if (!this.game) {
      this.broadcast('player_joined', {
        player: this.players[this.players.length - 1]?.toJSON(),
        players: this.players.map(p => p.toJSON()),
        settings: {
          rounds: this.roundsSetting,
          drawTime: this.drawTimeSetting,
          maxPlayers: this.maxPlayersSetting,
          wordCount: this.wordCountSetting,
          hints: this.hintsSetting,
          wordMode: this.wordModeSetting,
          roomType: this.roomTypeSetting
        }
      });
    }
  }

  /**
   * Cleans up timers
   */
  public destroy() {
    if (this.game) {
      this.game.stopTimers();
      this.game = null;
    }
    console.log(`🧹 Room ${this.id} destroyed.`);
  }
}
