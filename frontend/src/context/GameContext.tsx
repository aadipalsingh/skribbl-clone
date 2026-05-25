'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { GameState, Player } from '../../../shared/types';

interface GameContextType {
  gameState: GameState;
  players: Player[];
  timeLeft: number;
  drawTime: number;
  rounds: number;
  maxPlayers: number;
  wordCount: number;
  hintsSetting: number;
  wordMode: string;
  roomType: string;
  wordOptions: string[];
  isMeDrawing: boolean;
  isMeDrawer: boolean;
  myPlayerProfile: Player | undefined;
  socketId: string | undefined;
}

const initialGameState: GameState = {
  phase: 'lobby',
  round: 1,
  drawerId: '',
  word: '',
  hints: [],
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Local client-side timer and rounds management
  const [timeLeft, setTimeLeft] = useState(60);
  const [drawTime, setDrawTime] = useState(60);
  const [rounds, setRounds] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [wordCount, setWordCount] = useState(3);
  const [hintsSetting, setHintsSetting] = useState(2);
  const [wordMode, setWordMode] = useState('Normal');
  const [roomType, setRoomType] = useState('private');
  const [wordOptions, setWordOptions] = useState<string[]>([]);

  // React Ref to avoid stale closure issues in handleGameState callback
  const drawTimeRef = useRef(60);
  useEffect(() => {
    drawTimeRef.current = drawTime;
  }, [drawTime]);
  
  // Reactive socket ID state to prevent React-Socket timing issues
  const [socketId, setSocketId] = useState<string | undefined>(socket.id);

  const myPlayerProfile = players.find(p => p.id === (socketId || socket.id));
  const isMeDrawing = gameState.drawerId === (socketId || socket.id) && gameState.phase === 'drawing';
  const isMeDrawer = gameState.drawerId === (socketId || socket.id);

  useEffect(() => {
    // Sync initial socket connection state if already established
    if (socket.connected) {
      setSocketId(socket.id);
    }

    // 1. Connection listeners to drive reactivity when socket.id is assigned or cleared
    const handleConnect = () => {
      setSocketId(socket.id);
    };
    const handleDisconnect = () => {
      setSocketId(undefined);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // 2. Listen for player registry changes
    const handlePlayerJoined = (payload: {
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
    }) => {
      setPlayers(payload.players);
      if (payload.settings) {
        setRounds(payload.settings.rounds);
        setDrawTime(payload.settings.drawTime);
        if (payload.settings.maxPlayers) setMaxPlayers(payload.settings.maxPlayers);
        if (payload.settings.wordCount) setWordCount(payload.settings.wordCount);
        if (payload.settings.hints !== undefined) setHintsSetting(payload.settings.hints);
        if (payload.settings.wordMode) setWordMode(payload.settings.wordMode);
        if (payload.settings.roomType) setRoomType(payload.settings.roomType);
      }
    };

    const handlePlayerLeft = (payload: { playerId: string; players: Player[] }) => {
      setPlayers(payload.players);
    };

    // 3. Listen for game state shifts
    const handleGameState = (payload: GameState) => {
      setGameState((prev) => {
        // Only update timer on actual phase changes to prevent fighting with server ticks
        if (prev.phase !== payload.phase) {
          if (payload.phase === 'selecting_word') {
            setTimeLeft(15);
          } else if (payload.phase === 'drawing') {
            setTimeLeft(drawTimeRef.current);
          } else if (payload.phase === 'round_end' || payload.phase === 'game_over') {
            setTimeLeft(0);
          }
        }
        return payload;
      });
    };

    // 4. Listen for round start details
    const handleRoundStart = (payload: { drawerId: string; wordOptions: string[]; drawTime: number }) => {
      setDrawTime(payload.drawTime);
      setWordOptions(payload.wordOptions || []);
    };

    // 5. Listen for round end details
    const handleRoundEnd = (payload: { word: string; scores: Record<string, number>; nextDrawer: string }) => {
      // Sync scores list
      setPlayers((prev) =>
        prev.map((p) => ({
          ...p,
          score: payload.scores[p.id] !== undefined ? payload.scores[p.id] : p.score,
        }))
      );
    };

    // 6. Listen for game over details
    const handleGameOver = (payload: { winner: Player; leaderboard: Player[] }) => {
      setPlayers(payload.leaderboard);
    };

    // 7. Listen for room destruction details (e.g. host leaves)
    const handleRoomDestroyed = (payload: { reason: string }) => {
      alert(`⚠️ Room Destroyed: ${payload.reason}`);
      window.location.href = '/';
    };

    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    socket.on('game_state', handleGameState);
    socket.on('round_start', handleRoundStart);
    socket.on('round_end', handleRoundEnd);
    socket.on('game_over', handleGameOver);
    socket.on('room_destroyed', handleRoomDestroyed);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
      socket.off('game_state', handleGameState);
      socket.off('round_start', handleRoundStart);
      socket.off('round_end', handleRoundEnd);
      socket.off('game_over', handleGameOver);
      socket.off('room_destroyed', handleRoomDestroyed);
    };
  }, []);

  // Client-side ticking countdown for timer smooth rendering
  useEffect(() => {
    if (gameState.phase === 'lobby' || gameState.phase === 'game_over' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.phase, timeLeft]);

  return (
    <GameContext.Provider value={{ gameState, players, timeLeft, drawTime, rounds, maxPlayers, wordCount, hintsSetting, wordMode, roomType, wordOptions, isMeDrawing, isMeDrawer, myPlayerProfile, socketId }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
