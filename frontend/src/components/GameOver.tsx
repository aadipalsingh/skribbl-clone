'use client';

import React from 'react';
import { useGame } from '../context/GameContext';
import { socket } from '../lib/socket';
import styles from './GameOver.module.css';

export default function GameOver() {
  const { players, socketId } = useGame();

  // Autorun safe double sorting in descending score order
  const sorted = [...players].sort((a, b) => b.score - a.score);

  const firstPlace = sorted[0];
  const secondPlace = sorted[1];
  const thirdPlace = sorted[2];

  const handleReturnHome = () => {
    // Completely disconnect socket and redirect to home
    socket.disconnect();
    window.location.href = '/';
  };

  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <h1 className={`${styles.title} text-gradient-neon`}>GAME OVER</h1>
        <p className={styles.subtitle}>🏆 The paints have settled! Here is the final leaderboard: 🏆</p>
      </div>

      {/* PODIUM DISPLAY */}
      <div className={styles.podiumSection}>
        {/* 1st Place Card */}
        {firstPlace && (
          <div className={styles.podiumCol}>
            <div className={`${styles.podiumCard} ${styles.place1}`}>
              <span className={styles.medal} title="1st Place Winner!">👑</span>
              <div className={styles.podiumAvatar}>{firstPlace.avatar}</div>
              <div className={styles.podiumName}>{firstPlace.name}</div>
              <div className={styles.podiumScore}>{firstPlace.score} pts</div>
            </div>
          </div>
        )}

        {/* 2nd Place Card */}
        {secondPlace && (
          <div className={styles.podiumCol}>
            <div className={`${styles.podiumCard} ${styles.place2}`}>
              <span className={styles.medal} title="2nd Place Winner!">🥈</span>
              <div className={styles.podiumAvatar}>{secondPlace.avatar}</div>
              <div className={styles.podiumName}>{secondPlace.name}</div>
              <div className={styles.podiumScore}>{secondPlace.score} pts</div>
            </div>
          </div>
        )}

        {/* 3rd Place Card */}
        {thirdPlace && (
          <div className={styles.podiumCol}>
            <div className={`${styles.podiumCard} ${styles.place3}`}>
              <span className={styles.medal} title="3rd Place Winner!">🥉</span>
              <div className={styles.podiumAvatar}>{thirdPlace.avatar}</div>
              <div className={styles.podiumName}>{thirdPlace.name}</div>
              <div className={styles.podiumScore}>{thirdPlace.score} pts</div>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED LEADERBOARD LIST */}
      <div className={styles.leaderboardSection}>
        <h3 className={styles.sectionTitle}>Final Standings</h3>
        <div className={styles.listWrapper}>
          {sorted.map((player, index) => {
            const isMe = player.id === (socketId || socket.id);
            const rank = index + 1;

            return (
              <div key={player.id} className={styles.playerRow}>
                <div className={styles.leftSection}>
                  <span className={`${styles.rank} ${isMe ? styles.rankMe : ''}`}>#{rank}</span>
                  <span className={styles.avatar}>{player.avatar}</span>
                  <div className={styles.details}>
                    <span className={`${styles.name} ${isMe ? styles.nameMe : ''}`}>
                      {player.name} {isMe && ' (You)'}
                    </span>
                  </div>
                </div>
                <div className={styles.score}>{player.score} pts</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTION SYSTEM BUTTONS */}
      <div className={styles.buttonContainer}>
        <button className={styles.actionBtn} onClick={handleReturnHome}>
          🚪 Exit to Home
        </button>
      </div>
    </div>
  );
}
