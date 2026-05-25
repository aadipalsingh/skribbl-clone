'use client';

import React from 'react';
import { socket } from '../lib/socket';
import { useGame } from '../context/GameContext';
import styles from './Toolbox.module.css';

const PALETTE = [
  '#000000', // Black
  '#64748b', // Slate Gray
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#78350f', // Brown
  '#ffffff', // White (draw background)
];

const BRUSH_SIZES = [
  { label: 'S', value: 4, size: 8 },
  { label: 'M', value: 10, size: 14 },
  { label: 'L', value: 18, size: 22 },
  { label: 'XL', value: 30, size: 30 },
];

interface ToolboxProps {
  color: string;
  setColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
}

export default function Toolbox({ color, setColor, brushSize, setBrushSize }: ToolboxProps) {
  const { isMeDrawing } = useGame();

  // If this client is not drawing, do not display the drawing toolbox!
  if (!isMeDrawing) return null;

  const handleClearCanvas = () => {
    if (confirm('Are you sure you want to clear your entire drawing? 🧹')) {
      socket.emit('canvas_clear');
    }
  };

  const handleUndo = () => {
    socket.emit('draw_undo');
  };

  const selectColor = (c: string) => {
    setColor(c);
  };

  const isEraserActive = color === '#ffffff';

  return (
    <div className={styles.toolboxContainer}>
      {/* Colors Section */}
      <div className={styles.section}>
        <span className={styles.title}>Palette</span>
        <div className={styles.colorsGrid}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.colorDot} ${color === c && !isEraserActive ? styles.colorDotActive : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => selectColor(c)}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Sizing Section */}
      <div className={styles.section}>
        <span className={styles.title}>Size</span>
        <div className={styles.sizesRow}>
          {BRUSH_SIZES.map((sz) => (
            <button
              key={sz.value}
              type="button"
              className={`${styles.sizeCircle} ${brushSize === sz.value ? styles.sizeCircleActive : ''}`}
              style={{ width: 42, height: 42 }}
              onClick={() => setBrushSize(sz.value)}
              title={`${sz.label} size (${sz.value}px)`}
            >
              <div 
                className={styles.brushIndicator}
                style={{ 
                  width: sz.size, 
                  height: sz.size,
                  backgroundColor: brushSize === sz.value ? undefined : isEraserActive ? '#64748b' : color
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Actions Row */}
      <div className={styles.section}>
        <span className={styles.title}>Actions</span>
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.eraserBtn} ${isEraserActive ? styles.actionBtnActive : ''}`}
            onClick={() => setColor('#ffffff')}
            title="Toggle Eraser"
          >
            <span>🧽</span>
            <span>Eraser</span>
          </button>
          
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleUndo}
            title="Undo Last Stroke"
          >
            <span>↩️</span>
            <span>Undo</span>
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleClearCanvas}
            title="Clear Canvas"
          >
            <span>🧹</span>
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}
