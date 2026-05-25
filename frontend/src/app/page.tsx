'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '../lib/socket';
import AvatarSelector from '../components/AvatarSelector';
import LobbyChat from '../components/LobbyChat';
import styles from './page.module.css';

interface Player {
  id: string;
  name: string;
  score: number;
  avatar: string;
  isHost?: boolean;
}

export default function GameHome() {
  const router = useRouter();

  // Navigation / View State
  const [activeTab, setActiveTab] = useState<'play' | 'create' | 'join'>('play');
  const [isLobby, setIsLobby] = useState(false);

  // User Profile State
  const [playerName, setPlayerName] = useState('');
  const [avatar, setAvatar] = useState('🐶');

  // Room Join State
  const [roomIdInput, setRoomIdInput] = useState('');

  // Socket sync state
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);

  const [roomType, setRoomType] = useState<'private' | 'public'>('private');

  // Configurable game settings (defaults)
  const [rounds, setRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(60);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [wordCount, setWordCount] = useState(3);
  const [hints, setHints] = useState(2);
  const [wordMode, setWordMode] = useState('Normal');

  useEffect(() => {
    // Listen for room entry
    const handlePlayerJoined = (payload: { player: Player; players: Player[] }) => {
      setPlayers(payload.players);
      
      // Determine if I am the host
      const me = payload.players.find(p => p.id === socket.id);
      if (me) {
        setIsHost(!!me.isHost);
      }

      setIsLobby(true);
    };

    // Listen for player leaves
    const handlePlayerLeft = (payload: { playerId: string; players: Player[] }) => {
      setPlayers(payload.players);
      
      // Keep host status sync'd
      const me = payload.players.find(p => p.id === socket.id);
      if (me) {
        setIsHost(!!me.isHost);
      }
    };

    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);

    return () => {
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
    };
  }, []);

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    socket.connect();
    socket.emit('quick_join', {
      playerName: playerName.trim(),
      avatar: avatar
    }, (response) => {
      if (response && response.roomId) {
        if (response.isNew) {
          // Redirect to a dynamically created public room with default settings
          router.push(`/room/${response.roomId}?create=true&name=${encodeURIComponent(playerName.trim())}&avatar=${encodeURIComponent(avatar)}&rounds=3&drawTime=60&maxPlayers=10&wordCount=3&hints=2&wordMode=Normal&roomType=public`);
        } else {
          // Quick match into existing room
          router.push(`/room/${response.roomId}?name=${encodeURIComponent(playerName.trim())}&avatar=${encodeURIComponent(avatar)}`);
        }
      }
    });
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    // Client-side code generation
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Redirect to room page and pass credentials via query params to prevent socket mount race conditions
    router.push(`/room/${roomId}?create=true&name=${encodeURIComponent(playerName.trim())}&avatar=${encodeURIComponent(avatar)}&rounds=${rounds}&drawTime=${drawTime}&maxPlayers=${maxPlayers}&wordCount=${wordCount}&hints=${hints}&wordMode=${wordMode}&roomType=${roomType}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomIdInput.trim()) return;

    const formattedCode = roomIdInput.trim().toUpperCase();
    
    // Redirect to room page and pass credentials via query params
    router.push(`/room/${formattedCode}?name=${encodeURIComponent(playerName.trim())}&avatar=${encodeURIComponent(avatar)}`);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert('Room code copied to clipboard! 📋');
  };

  // 1. LOBBY STATE RENDER
  if (isLobby) {
    return (
      <div className={styles.container}>
        <div className={styles.brand}>
          <h1 className="text-gradient-neon">LOBBY ROOM</h1>
          <p>Prepare your brushes. Game is starting soon!</p>
        </div>

        <div className={styles.lobbyContainer}>
          <div className={styles.lobbyMain}>
            <div className={styles.lobbyCard}>
              <div className={styles.lobbyHeader}>
                <div>
                  <h2>Lobby Players ({players.length})</h2>
                </div>
                <div className={styles.roomCodeBox}>
                  <span className={styles.summaryLabel}>Code: </span>
                  <span className={styles.roomCodeText}>{roomCode}</span>
                  <button className={styles.copyBtn} onClick={copyRoomCode} title="Copy Code">
                    📋
                  </button>
                </div>
              </div>

              <div className={styles.playersGrid}>
                {players.map((player) => (
                  <div key={player.id} className={styles.playerCard}>
                    {player.isHost && <span className={styles.hostBadge}>Host</span>}
                    <div className={styles.playerAvatar}>{player.avatar}</div>
                    <div className={styles.playerName}>{player.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button className={styles.actionBtn}>
                🚀 Start Game
              </button>
            ) : (
              <div className={styles.pulsingWaiting}>
                🎨 Waiting for host {players.find(p => p.isHost)?.name || ''} to start the game...
              </div>
            )}
          </div>

          <div className={styles.lobbySidebar}>
            <div className={styles.settingsSummary}>
              <h3>Game Settings</h3>
              <div className={styles.summaryList}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Rounds:</span>
                  <span className={styles.summaryValue}>{rounds} Rounds</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Draw Time:</span>
                  <span className={styles.summaryValue}>{drawTime} Seconds</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Mode:</span>
                  <span className={styles.summaryValue}>Classic (Standard)</span>
                </div>
              </div>
            </div>

            <LobbyChat />
          </div>
        </div>
      </div>
    );
  }

  // 2. LANDING HOME STATE RENDER
  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <h1 className="skribbl-logo">
          <span>s</span>
          <span>k</span>
          <span>r</span>
          <span>i</span>
          <span>b</span>
          <span>b</span>
          <span>l</span>
          <span>.</span>
          <span>i</span>
          <span>o</span>
        </h1>
        <p style={{ color: '#86a3bc', fontWeight: 700 }}>Real-time multiplayer drawing and guessing game</p>
      </div>

      <div className={styles.mainCard}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'play' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('play')}
          >
            Play (Quick Match)
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'create' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Room
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'join' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Join Room
          </button>
        </div>

        <form onSubmit={
          activeTab === 'play'
            ? handleQuickJoin
            : activeTab === 'create'
              ? handleCreateRoom
              : handleJoinRoom
        }>
          {/* Avatar Selector */}
          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Choose your Avatar</span>
            <AvatarSelector value={avatar} onChange={setAvatar} />
          </div>

          {/* Nickname Input */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              type="text"
              className={styles.textInput}
              placeholder="e.g. Picasso"
              required
              maxLength={12}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>

          {activeTab === 'play' ? (
            /* Play (Quick Match) view */
            <div className={styles.settingsSection}>
              <span className={styles.formLabel} style={{ display: 'block', marginBottom: '1.25rem', fontStyle: 'italic', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                Quick Match will instantly connect you into an active public game lobby or create a new public room if none are available! 🎮
              </span>
              
              <button type="submit" className={`${styles.actionBtn} ${styles.playBtn}`}>
                🎮 Play Now (Quick Match)
              </button>
            </div>
          ) : activeTab === 'create' ? (
            /* Create Room Options */
            <div className={styles.settingsSection}>
              <span className={styles.formLabel}>Lobby Settings</span>
              
              <div className={styles.sliderContainer} style={{ marginTop: '1rem' }}>
                <div className={styles.sliderHeader}>
                  <span>Max Players</span>
                  <span className={styles.sliderValue}>{maxPlayers} Players</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  className={styles.slider}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                />
              </div>

              <div className={styles.sliderContainer}>
                <div className={styles.sliderHeader}>
                  <span>Rounds</span>
                  <span className={styles.sliderValue}>{rounds} Rounds</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  className={styles.slider}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                />
              </div>

              <div className={styles.sliderContainer}>
                <div className={styles.sliderHeader}>
                  <span>Draw Time</span>
                  <span className={styles.sliderValue}>{drawTime}s</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="240"
                  step="15"
                  className={styles.slider}
                  value={drawTime}
                  onChange={(e) => setDrawTime(Number(e.target.value))}
                />
              </div>

              <div className={styles.sliderContainer}>
                <div className={styles.sliderHeader}>
                  <span>Word Options</span>
                  <span className={styles.sliderValue}>{wordCount} Words</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  className={styles.slider}
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                />
              </div>

              <div className={styles.sliderContainer}>
                <div className={styles.sliderHeader}>
                  <span>Hints per Word</span>
                  <span className={styles.sliderValue}>{hints === 0 ? 'Disabled' : `${hints} Hints`}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  className={styles.slider}
                  value={hints}
                  onChange={(e) => setHints(Number(e.target.value))}
                />
              </div>

              <div className={styles.formGroup} style={{ marginTop: '1.25rem' }}>
                <label className={styles.formLabel} htmlFor="wordMode">Word Mode</label>
                <select
                  id="wordMode"
                  className={styles.selectInput}
                  value={wordMode}
                  onChange={(e) => setWordMode(e.target.value)}
                >
                  <option value="Normal">Normal</option>
                  <option value="Hidden">Hidden (No blanks shown)</option>
                  <option value="Combination">Combination (No hints revealed)</option>
                </select>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '1.25rem' }}>
                <label className={styles.formLabel} htmlFor="roomType">Room Visibility</label>
                <select
                  id="roomType"
                  className={styles.selectInput}
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value as 'private' | 'public')}
                >
                  <option value="private">Private (Invite only via link/code)</option>
                  <option value="public">Public (Open for Quick Match matchmaking)</option>
                </select>
              </div>

              <button type="submit" className={styles.actionBtn}>
                🎨 Create Room
              </button>
            </div>
          ) : (
            /* Join Room Options */
            <div className={styles.settingsSection}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="roomCode">Room Code</label>
                <input
                  id="roomCode"
                  type="text"
                  className={styles.textInput}
                  placeholder="e.g. X8A4K1"
                  required
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                />
              </div>

              <button type="submit" className={styles.actionBtn}>
                🚀 Join Room
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
