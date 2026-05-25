'use client';

import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import styles from './LobbyChat.module.css';

interface Message {
  id: string;
  type: 'system' | 'chat';
  senderId?: string;
  senderName?: string;
  text: string;
}

export default function LobbyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for incoming chat messages
    const handleChatMessage = (payload: { playerId: string; playerName: string; text: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type: 'chat',
          senderId: payload.playerId,
          senderName: payload.playerName,
          text: payload.text,
        },
      ]);
    };

    // Listen for new player joins to show a system message
    const handlePlayerJoined = (payload: { player: { id: string; name: string; avatar: string } }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: `${payload.player.avatar} ${payload.player.name} joined the room!`,
        },
      ]);
    };

    // Listen for player leaves to show a system message
    const handlePlayerLeft = (payload: { playerId: string; players: any[] }) => {
      // Find the player name if possible (or just generic text)
      // Since players contains the updated list, we can just say "A player left"
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: `👋 A player left the room`,
        },
      ]);
    };

    socket.on('chat_message', handleChatMessage);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);

    // Initial welcome system message
    setMessages([
      {
        id: 'welcome',
        type: 'system',
        text: '💬 Welcome to the room! Chat here while waiting for the host to start.',
      },
    ]);

    return () => {
      socket.off('chat_message', handleChatMessage);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
    };
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Send the chat message to the server
    socket.emit('chat', { text: inputText.trim() });
    setInputText('');
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <div className={styles.headerTitle}>
          <span>💬</span>
          <span>Room Chat</span>
        </div>
      </div>

      <div className={styles.messagesList}>
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className={styles.messageRow}>
                <div className={styles.systemMessage}>{msg.text}</div>
              </div>
            );
          }

          const isMe = msg.senderId === socket.id;

          return (
            <div key={msg.id} className={msg.senderId === socket.id ? styles.messageRow : styles.messageRow}>
              <div className={isMe ? styles.myMessageBubble : styles.userMessageBubble}>
                {!isMe && <div className={styles.senderName}>{msg.senderName}</div>}
                <div className={styles.messageText}>{msg.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className={styles.inputForm}>
        <input
          type="text"
          className={styles.inputField}
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button type="submit" className={styles.sendButton}>
          Send
        </button>
      </form>
    </div>
  );
}
