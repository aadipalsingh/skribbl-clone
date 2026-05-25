'use client';

import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { useGame } from '../context/GameContext';
import styles from './Chat.module.css';

interface Message {
  id: string;
  type: 'chat' | 'system' | 'correct' | 'close';
  senderId?: string;
  senderName?: string;
  text: string;
}

export default function Chat() {
  const { isMeDrawing, gameState } = useGame();
  const [messages, setMessages] = useState<Message[]>([]);
  const [guessInput, setGuessInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);

  // Auto-scroll messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset guess status when the drawer changes (new round starts)
  useEffect(() => {
    setHasGuessedCorrectly(false);
  }, [gameState.drawerId]);

  useEffect(() => {
    // 1. Listen for regular and system chat messages
    const handleChatMessage = (payload: { playerId: string; playerName: string; text: string }) => {
      let type: 'chat' | 'system' | 'correct' | 'close' = 'chat';

      if (payload.playerId === 'system') {
        type = 'system';
      } else if (payload.playerId === 'correct') {
        type = 'correct';
      } else if (payload.playerId === 'close') {
        type = 'close';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type,
          senderId: payload.playerId,
          senderName: payload.playerName,
          text: payload.text,
        },
      ]);
    };

    // 2. Listen for guess_result dynamically to update local client locked inputs
    const handleGuessResult = (payload: { correct: boolean; playerId: string; playerName: string; points: number }) => {
      if (payload.correct && payload.playerId === socket.id) {
        setHasGuessedCorrectly(true);
      }
    };

    socket.on('chat_message', handleChatMessage);
    socket.on('guess_result', handleGuessResult);

    // Initial system notice
    setMessages([
      {
        id: 'init',
        type: 'system',
        text: '✏️ Type your guesses in the input below. Earn points for speed!',
      },
    ]);

    return () => {
      socket.off('chat_message', handleChatMessage);
      socket.off('guess_result', handleGuessResult);
    };
  }, []);

  const handleSendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim()) return;

    // Send guess or regular chat depending on context
    const isDrawingPhase = gameState.phase === 'drawing';
    const isGuesser = !isMeDrawing && !hasGuessedCorrectly;

    if (isDrawingPhase && isGuesser) {
      // Type-safe guess event per assignment spec
      socket.emit('guess', { text: guessInput.trim() });
    } else {
      // Type-safe chat event per assignment spec
      socket.emit('chat', { text: guessInput.trim() });
    }
    
    setGuessInput('');
  };

  const isInputDisabled = isMeDrawing || hasGuessedCorrectly || gameState.phase !== 'drawing';

  let inputPlaceholder = 'Type your guess here...';
  if (isMeDrawing) {
    inputPlaceholder = 'You are the drawer!';
  } else if (hasGuessedCorrectly) {
    inputPlaceholder = 'You guessed the word! 🎉';
  } else if (gameState.phase !== 'drawing') {
    inputPlaceholder = 'Waiting for round...';
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesList}>
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className={styles.messageRow}>
                <div className={styles.systemMsg}>{msg.text}</div>
              </div>
            );
          }

          if (msg.type === 'correct') {
            return (
              <div key={msg.id} className={styles.messageRow}>
                <div className={styles.correctGuess}>🎉 {msg.text}</div>
              </div>
            );
          }

          if (msg.type === 'close') {
            return (
              <div key={msg.id} className={styles.messageRow}>
                <div className={styles.closeGuess}>⚠️ {msg.text}</div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={styles.messageRow}>
              <div className={styles.chatMsg}>
                <span className={styles.senderName}>{msg.senderName}:</span>
                <span>{msg.text}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendGuess} className={styles.inputForm}>
        <input
          type="text"
          className={`${styles.inputField} ${isInputDisabled ? styles.inputFieldDisabled : ''}`}
          placeholder={inputPlaceholder}
          value={guessInput}
          disabled={isInputDisabled}
          onChange={(e) => setGuessInput(e.target.value)}
          maxLength={20}
          autoComplete="off"
        />
        <button 
          type="submit" 
          className={styles.submitBtn} 
          disabled={isInputDisabled}
        >
          Guess
        </button>
      </form>
    </div>
  );
}
