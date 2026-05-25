'use client';

import React from 'react';
import { socket } from '../lib/socket';
import { useGame } from '../context/GameContext';
import styles from './PlayerList.module.css';

export default function PlayerList() {
  const { gameState, players } = useGame();

  // Create a copy and sort players descending by score for the leaderboard
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={styles.listContainer}>
      {sortedPlayers.map((player, index) => {
        const isMe = player.id === socket.id;
        const isDrawing = player.id === gameState.drawerId && gameState.phase === 'drawing';
        const rank = index + 1;

        // Custom rank metallic colors
        let rankClass = styles.rank;
        if (rank === 1) rankClass = `${styles.rank} ${styles.rank1}`;
        else if (rank === 2) rankClass = `${styles.rank} ${styles.rank2}`;
        else if (rank === 3) rankClass = `${styles.rank} ${styles.rank3}`;

        return (
          <div 
            key={player.id} 
            className={`${styles.playerRow} ${isDrawing ? styles.playerRowDrawing : ''}`}
          >
            <div className={styles.leftSection}>
              <div className={rankClass}>#{rank}</div>
              <div className={styles.avatar}>{player.avatar}</div>
              <div className={styles.details}>
                <div className={`${styles.name} ${isMe ? styles.nameMe : ''}`}>
                  {player.name} {isMe && ' (You)'}
                </div>
                <div className={styles.score}>{player.score} pts</div>
              </div>
            </div>

            <div className={styles.rightSection}>
              {isDrawing && (
                <div className={`${styles.indicatorBadge} ${styles.pencilBadge}`} title="Drawing Now!">
                  ✏️
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
