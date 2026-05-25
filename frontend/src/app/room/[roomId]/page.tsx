'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { socket } from '../../../lib/socket';
import { GameProvider, useGame } from '../../../context/GameContext';
import Canvas from '../../../components/Canvas';
import Toolbox from '../../../components/Toolbox';
import Chat from '../../../components/Chat';
import PlayerList from '../../../components/PlayerList';
import WordReveal from '../../../components/WordReveal';
import LobbyChat from '../../../components/LobbyChat';
import AvatarSelector from '../../../components/AvatarSelector';
import GameOver from '../../../components/GameOver';
import styles from './room.module.css';
import lobbyStyles from '../../page.module.css';

interface Player {
  id: string;
  name: string;
  score: number;
  avatar: string;
  isHost?: boolean;
}

// 1. THE INNER CONTENT (Consumed inside GameProvider)
function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = (params.roomId as string || '').toUpperCase();
  
  const { gameState, players, drawTime, rounds, maxPlayers, wordCount, hintsSetting, wordMode, roomType, isMeDrawing } = useGame();
  
  // Brush options local state (passed to Canvas and Toolbox)
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(10);

  // Profile states if user lands directly via link and needs to join
  const [playerName, setPlayerName] = useState('');
  const [avatar, setAvatar] = useState('🐶');
  const [hasJoined, setHasJoined] = useState(false);

  // Disconnect socket on unmount to prevent ghost/stale players remaining in lobbies
  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-join if player navigated from the home page with query parameters
  useEffect(() => {
    const queryName = searchParams.get('name');
    const queryCreate = searchParams.get('create');
    const queryAvatar = searchParams.get('avatar') || '🐶';
    const queryRounds = searchParams.get('rounds');
    const queryDrawTime = searchParams.get('drawTime');
    const queryMaxPlayers = searchParams.get('maxPlayers') || '10';
    const queryWordCount = searchParams.get('wordCount') || '3';
    const queryHints = searchParams.get('hints') || '2';
    const queryWordMode = searchParams.get('wordMode') || 'Normal';
    const queryRoomType = searchParams.get('roomType') || 'private';

    if (queryName && !hasJoined) {
      const timer = setTimeout(() => {
        socket.connect();
        
        if (queryCreate === 'true') {
          // Emit create_room per exact spec
          socket.emit('create_room', {
            hostName: queryName,
            avatar: queryAvatar, // Pass custom avatar!
            roomId, // Pass client-generated roomId so it matches URL exactly!
            settings: {
              rounds: Number(queryRounds || 3),
              drawTime: Number(queryDrawTime || 60),
              maxPlayers: Number(queryMaxPlayers),
              wordCount: Number(queryWordCount),
              hints: Number(queryHints),
              wordMode: queryWordMode,
              roomType: queryRoomType as 'public' | 'private'
            }
          });
        } else {
          // Emit join_room per exact spec
          socket.emit('join_room', {
            roomId,
            playerName: queryName,
            avatar: queryAvatar // Pass custom avatar!
          });
        }

        // Set hasJoined to true AFTER socket connect and emit have run,
        // avoiding dependency update cleanup race condition!
        setHasJoined(true);
      }, 50); // Small 50ms delay guarantees GameProvider registers socket listeners first

      return () => clearTimeout(timer);
    }
  }, [searchParams, roomId, hasJoined]);

  // Check if I am already registered in the players list in real-time
  const { socketId } = useGame();
  const isRegistered = players.some((p: Player) => p.id === (socketId || socket.id));

  // Handle direct join submission (link invite without query params)
  const handleDirectJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    socket.connect();
    socket.emit('join_room', {
      roomId,
      playerName: playerName.trim(),
      avatar: avatar // Pass selected avatar!
    });
    setHasJoined(true);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room code copied to clipboard! 📋');
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    alert('Invite link copied to clipboard! 🔗📋');
  };

  // Elect start game handler (only available to Host in lobby)
  const handleStartGame = () => {
    socket.emit('start_game');
  };

  const queryName = searchParams.get('name');
  const isAutoJoining = !!queryName;

  // STATE A: If player landed via URL invite and needs to register/join first
  if (!isRegistered && !hasJoined && !isAutoJoining) {
    return (
      <div className={styles.joinOverlay}>
        <div className={lobbyStyles.mainCard}>
          <div className={lobbyStyles.brand}>
            <h1 className="skribbl-logo" style={{ fontSize: '2.5rem' }}>
              <span>j</span><span>o</span><span>i</span><span>n</span><span>&nbsp;</span><span>r</span><span>o</span><span>o</span><span>m</span>
            </h1>
            <p style={{ color: '#86a3bc', fontWeight: 700 }}>You have been invited to room: <strong>{roomId}</strong></p>
          </div>

          <form onSubmit={handleDirectJoin}>
            <div className={lobbyStyles.formGroup}>
              <span className={lobbyStyles.formLabel}>Choose your Avatar</span>
              <AvatarSelector value={avatar} onChange={setAvatar} />
            </div>

            <div className={lobbyStyles.formGroup}>
              <label className={lobbyStyles.formLabel} htmlFor="direct-name">Nickname</label>
              <input
                id="direct-name"
                type="text"
                className={lobbyStyles.textInput}
                placeholder="e.g. Picasso"
                required
                maxLength={12}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>

            <button type="submit" className={lobbyStyles.actionBtn}>
              🚀 Join Lobby
            </button>
          </form>
        </div>
      </div>
    );
  }

  // STATE B: If in LOBBY wait state (Game hasn't started yet)
  if (gameState.phase === 'lobby') {
    const myProfile = players.find((p: Player) => p.id === (socketId || socket.id));
    const isHost = myProfile?.isHost;

    console.log('🔍 [LOBBY DEBUG]:', {
      socketId,
      socket_id: socket.id,
      socket_connected: socket.connected,
      players,
      myProfile,
      isHost
    });

    return (
      <div className={lobbyStyles.container}>
        <div className={lobbyStyles.brand}>
          <h1 className="skribbl-logo">
            <span>l</span><span>o</span><span>b</span><span>b</span><span>y</span><span>&nbsp;</span><span>r</span><span>o</span><span>o</span><span>m</span>
          </h1>
          <p style={{ color: '#86a3bc', fontWeight: 700 }}>Prepare your brushes. Game is starting soon!</p>
        </div>

        <div className={lobbyStyles.lobbyContainer}>
          <div className={lobbyStyles.lobbyMain}>
            <div className={lobbyStyles.lobbyCard}>
              <div className={lobbyStyles.lobbyHeader}>
                <h2>Joined Players ({players.length})</h2>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button 
                    className={lobbyStyles.copyBtn} 
                    onClick={copyInviteLink} 
                    title="Copy Invite Link"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      padding: '0.6rem 1rem', 
                      fontSize: '0.9rem', 
                      borderRadius: '6px', 
                      background: 'var(--accent-secondary)', 
                      border: '3px solid var(--border-cartoon-color)',
                      boxShadow: '0 4px 0 var(--accent-secondary-border)',
                      cursor: 'pointer',
                      color: 'white',
                      fontWeight: 900
                    }}
                  >
                    🔗 Copy Invite Link
                  </button>
                  <div className={lobbyStyles.roomCodeBox}>
                    <span className={lobbyStyles.summaryLabel}>Code: </span>
                    <span className={lobbyStyles.roomCodeText}>{roomId}</span>
                    <button className={lobbyStyles.copyBtn} onClick={copyRoomCode} title="Copy Code">
                      📋
                    </button>
                  </div>
                </div>
              </div>

              <div className={lobbyStyles.playersGrid}>
                {players.map((player: Player) => (
                  <div key={player.id} className={lobbyStyles.playerCard}>
                    {player.isHost && <span className={lobbyStyles.hostBadge}>Host</span>}
                    <div className={lobbyStyles.playerAvatar}>{player.avatar}</div>
                    <div className={lobbyStyles.playerName}>{player.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button 
                className={`${lobbyStyles.actionBtn} ${players.length < 2 ? lobbyStyles.actionBtnDisabled : ''}`} 
                onClick={handleStartGame}
                disabled={players.length < 2}
                title={players.length < 2 ? "Need at least 2 players to start" : "Start the game!"}
              >
                {players.length < 2 ? '⚠️ Waiting for Players (Min 2)' : '🚀 Start Game'}
              </button>
            ) : (
              <div className={lobbyStyles.pulsingWaiting}>
                🎨 Waiting for host {players.find((p: Player) => p.isHost)?.name || ''} to start the game...
              </div>
            )}
          </div>

          <div className={lobbyStyles.lobbySidebar}>
            <div className={lobbyStyles.settingsSummary}>
              <h3>Game Settings</h3>
              <div className={lobbyStyles.summaryList}>
                <div className={lobbyStyles.summaryItem}>
                  <span className={lobbyStyles.summaryLabel}>Max Players:</span>
                  <span className={lobbyStyles.summaryValue}>{maxPlayers} Players</span>
                </div>
                <div className={lobbyStyles.summaryItem}>
                  <span className={lobbyStyles.summaryLabel}>Rounds:</span>
                  <span className={lobbyStyles.summaryValue}>{rounds} Rounds</span>
                </div>
                <div className={lobbyStyles.summaryItem}>
                  <span className={lobbyStyles.summaryLabel}>Draw Time:</span>
                  <span className={lobbyStyles.summaryValue}>{drawTime} Seconds</span>
                </div>
                <div className={lobbyStyles.summaryItem}>
                  <span className={lobbyStyles.summaryLabel}>Word Options:</span>
                  <span className={lobbyStyles.summaryValue}>{wordCount} Words</span>
                </div>
                <div className={lobbyStyles.summaryItem}>
                  <span className={lobbyStyles.summaryLabel}>Hints:</span>
                  <span className={lobbyStyles.summaryValue}>{hintsSetting === 0 ? 'Disabled' : `${hintsSetting} Hints`}</span>
                </div>
                <div className={lobbyStyles.summaryItem}>
                  <span className={lobbyStyles.summaryLabel}>Word Mode:</span>
                  <span className={lobbyStyles.summaryValue}>{wordMode}</span>
                </div>
                <div className={lobbyStyles.summaryItem}>
                  <span className={lobbyStyles.summaryLabel}>Room Type:</span>
                  <span className={lobbyStyles.summaryValue} style={{ textTransform: 'capitalize' }}>{roomType}</span>
                </div>
              </div>
            </div>

            <LobbyChat />
          </div>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'game_over') {
    return <GameOver />;
  }

  // STATE C: ACTIVE GAME STATE (drawing, word selection, round end, game over)
  return (
    <div className={styles.roomLayoutContainer}>
      {/* 1. Header reveal & timer bar */}
      <div className={styles.topBarRow}>
        <WordReveal />
      </div>

      {/* 2. Core Tri-Column Grid Dashboard */}
      <div className={styles.gridDashboard}>
        {/* Left Column: Leaderboard / PlayerList */}
        <div className={styles.panelCard} style={{ height: '100%', minHeight: 400 }}>
          <h3 className={styles.panelTitle}>Leaderboard</h3>
          <PlayerList />
        </div>

        {/* Center Column: Canvas & Drawer Controls */}
        <div className={styles.centerDrawColumn}>
          <Canvas color={color} brushSize={brushSize} />
          <Toolbox 
            color={color} 
            setColor={setColor} 
            brushSize={brushSize} 
            setBrushSize={setBrushSize} 
          />
        </div>

        {/* Right Column: Chat/Guessing Input */}
        <div className={styles.panelCard} style={{ height: '100%', minHeight: 400 }}>
          <h3 className={styles.panelTitle}>Guesses & Chat</h3>
          <Chat />
        </div>
      </div>
    </div>
  );
}

// 2. THE OUTER SHELL (Provides GameProvider and Suspense boundary for useSearchParams)
export default function GameRoomPage() {
  return (
    <GameProvider>
      <React.Suspense fallback={<div className={styles.joinOverlay}><div className={lobbyStyles.mainCard}><h2>Loading lobby...</h2></div></div>}>
        <RoomContent />
      </React.Suspense>
    </GameProvider>
  );
}
