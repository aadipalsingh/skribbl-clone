'use client';

import React from 'react';
import { socket } from '../lib/socket';
import { useGame } from '../context/GameContext';
import styles from './WordReveal.module.css';

export default function WordReveal() {
  const { gameState, players, isMeDrawing, isMeDrawer, timeLeft, rounds, wordOptions } = useGame();
  const { phase, round, drawerId, word } = gameState;

  // Elect word select trigger exactly per assignment spec
  const handleSelectWord = (selectedWord: string) => {
    socket.emit('word_chosen', { word: selectedWord });
  };

  // Helper to split word into blanks visual array (e.g. "D O G" or "C _ R")
  const renderWordBlanks = () => {
    return (
      <div className={styles.blanksContainer}>
        {word.split('').map((char, index) => {
          if (char === ' ') {
            return <div key={index} className={styles.spacePlaceholder} />;
          }
          const isFilled = char !== '_';
          return (
            <div 
              key={index} 
              className={`${styles.blankLetter} ${isFilled ? styles.blankLetterFilled : ''}`}
            >
              {isFilled ? char : '\u00a0'}
            </div>
          );
        })}
      </div>
    );
  };

  const activeDrawerName = players.find(p => p.id === drawerId)?.name || 'Someone';
  const winner = [...players].sort((a, b) => b.score - a.score)[0];

  const isLowTime = timeLeft <= 15 && phase === 'drawing';

  return (
    <div className={styles.barContainer}>
      {/* Round Information widget */}
      <div className={styles.roundInfo}>
        <span className={styles.roundNumber}>
          {round} / {rounds}
        </span>
        <span className={styles.roundLabel}>Round</span>
      </div>

      {/* Main Center Action Zone */}
      <div className={styles.centerZone}>
        {phase === 'selecting_word' && (
          isMeDrawer ? (
            <div className={styles.selectionContainer}>
              <span className={styles.selectionTitle}>Choose a word to draw:</span>
              <div className={styles.wordsRow}>
                {wordOptions?.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={styles.wordBtn}
                    onClick={() => handleSelectWord(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span className={styles.selectionTitle} style={{ fontStyle: 'italic', animation: 'drawPulse 1.5s infinite' }}>
              🎨 {activeDrawerName} is choosing a word...
            </span>
          )
        )}

        {phase === 'drawing' && (
          isMeDrawing ? (
            <div style={{ textAlign: 'center' }}>
              <span className={styles.selectionTitle} style={{ display: 'block', marginBottom: '0.2rem' }}>Draw this word:</span>
              <span className={styles.chosenWordText}>{word}</span>
            </div>
          ) : (
            word === '❓ Hidden Word' ? (
              <span className={styles.chosenWordText} style={{ fontSize: '1.4rem', fontStyle: 'italic' }}>
                ❓ Hidden Word
              </span>
            ) : (
              renderWordBlanks()
            )
          )
        )}

        {phase === 'round_end' && (
          <div className={styles.roundEndText}>
            The secret word was: <span className={styles.chosenWordText}>{word}</span>!
          </div>
        )}

        {phase === 'game_over' && (
          <div className={styles.roundEndText} style={{ color: 'var(--accent-secondary)' }}>
            🏆 Game Finished! Winner: {winner?.name || 'No one'}
          </div>
        )}
      </div>

      {/* Timer Widget */}
      <div className={`${styles.timeContainer} ${isLowTime ? styles.timeUrgent : ''}`}>
        {timeLeft}
      </div>
    </div>
  );
}
