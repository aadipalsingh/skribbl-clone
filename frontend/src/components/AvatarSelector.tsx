'use client';

import React, { useState } from 'react';
import styles from './AvatarSelector.module.css';

// Selection of fun, expressive cartoon emojis for avatars
export const AVATARS = [
  '🐶', '🐱', '🦊', '🦁', '🐯', '🐼', '🐨', '🐻', 
  '🐷', '🐸', '🐵', '🐔', '🐧', '🦉', '🦄', '🦖',
  '🐙', '🐝', '🎨', '🚀', '👻', '👾', '🤠', '🤡',
  '🥷', '🧑‍🚀', '🧙', '🧟', '🦄', '🐳', '🍩', '🥑'
];

interface AvatarSelectorProps {
  value: string;
  onChange: (avatar: string) => void;
}

export default function AvatarSelector({ value, onChange }: AvatarSelectorProps) {
  const [isSpinning, setIsSpinning] = useState(false);

  const randomizeAvatar = () => {
    if (isSpinning) return;
    setIsSpinning(true);

    let counter = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * AVATARS.length);
      onChange(AVATARS[randomIndex]);
      counter++;

      if (counter > 8) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 80);
  };

  return (
    <div className={styles.selectorContainer}>
      <div className={styles.previewWrapper}>
        <span>{value}</span>
        <button 
          type="button" 
          className={styles.diceBadge} 
          onClick={randomizeAvatar}
          title="Randomize Avatar"
          style={{ transform: isSpinning ? 'rotate(360deg) scale(1.15)' : undefined, transition: isSpinning ? 'transform 0.6s ease' : 'transform 0.2s ease' }}
        >
          🎲
        </button>
      </div>

      <div className={styles.grid}>
        {AVATARS.map((emoji, index) => (
          <button
            key={index}
            type="button"
            className={`${styles.avatarOption} ${value === emoji ? styles.avatarOptionActive : ''}`}
            onClick={() => onChange(emoji)}
            aria-label={`Select avatar ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
