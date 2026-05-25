export interface Player {
  id: string;
  name: string;
  score: number;
  avatar: string;
  isHost?: boolean;
}

export interface GameState {
  phase: 'lobby' | 'selecting_word' | 'drawing' | 'round_end' | 'game_over';
  round: number;
  drawerId: string;
  word: string; // secret word (visible to drawer) or blanks/hints (visible to guessers)
  hints?: string[];
  timeLeft?: number;
}

export interface DrawStroke {
  type: 'start' | 'move' | 'end' | 'clear' | 'undo';
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

export interface ClientToServerEvents {
  // Room & Lobby
  create_room: (
    payload: {
      hostName: string;
      avatar?: string;
      roomId?: string;
      settings: {
        rounds: number;
        drawTime: number;
        maxPlayers?: number;
        wordCount?: number;
        hints?: number;
        wordMode?: string;
        roomType?: 'public' | 'private';
      };
    },
    callback?: (res: { roomId: string }) => void
  ) => void;
  join_room: (payload: { roomId: string; playerName: string; avatar?: string }) => void;
  quick_join: (
    payload: { playerName: string; avatar?: string },
    callback: (res: { roomId: string; isNew: boolean }) => void
  ) => void;
  start_game: () => void;

  // Game State
  word_chosen: (payload: { word: string }) => void;

  // Drawing
  draw_start: (payload: { x: number; y: number; color: string; size: number }) => void;
  draw_move: (payload: { x: number; y: number }) => void;
  draw_end: () => void;
  canvas_clear: () => void;
  draw_undo: () => void;

  // Chat & Guessing
  guess: (payload: { text: string }) => void;
  chat: (payload: { text: string }) => void;
}

export interface ServerToClientEvents {
  // Room & Lobby
  player_joined: (payload: {
    player: Player;
    players: Player[];
    settings?: {
      rounds: number;
      drawTime: number;
      maxPlayers?: number;
      wordCount?: number;
      hints?: number;
      wordMode?: string;
      roomType?: 'public' | 'private';
    };
  }) => void;
  player_left: (payload: { playerId: string; players: Player[] }) => void;
  room_destroyed: (payload: { reason: string }) => void;

  // Game State
  game_state: (payload: GameState) => void;
  round_start: (payload: { drawerId: string; wordOptions: string[]; drawTime: number }) => void;
  round_end: (payload: { word: string; scores: Record<string, number>; nextDrawer: string }) => void;
  game_over: (payload: { winner: Player; leaderboard: Player[] }) => void;

  // Drawing
  draw_data: (payload: DrawStroke) => void;

  // Chat & Guessing
  guess_result: (payload: { correct: boolean; playerId: string; playerName: string; points: number }) => void;
  chat_message: (payload: { playerId: string; playerName: string; text: string }) => void;
}
