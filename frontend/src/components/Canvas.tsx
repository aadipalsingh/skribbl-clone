'use client';

import React, { useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { useGame } from '../context/GameContext';
import { useDraw, Point } from '../hooks/useDraw';
import styles from './Canvas.module.css';

interface DrawAction {
  x: number;
  y: number;
  color?: string;
  size?: number;
}

interface Stroke {
  actions: DrawAction[];
}

interface CanvasProps {
  color: string;
  brushSize: number;
}

export default function Canvas({ color, brushSize }: CanvasProps) {
  const { isMeDrawing, gameState, players, socketId } = useGame();
  
  // Track the previous coordinate of the remote drawer to link move segments
  const remotePrevPointRef = useRef<Point | null>(null);

  // Stroke history and active stroke refs
  const currentStrokeRef = useRef<Stroke | null>(null);
  const remoteCurrentStrokeRef = useRef<Stroke | null>(null);
  const strokesHistoryRef = useRef<Stroke[]>([]);


  // Redraw helper that re-renders all saved strokes in history from scratch
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes in history
    strokesHistoryRef.current.forEach((stroke) => {
      if (stroke.actions.length === 0) return;

      const startAction = stroke.actions[0];
      ctx.strokeStyle = startAction.color || '#000000';
      ctx.lineWidth = startAction.size || 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Capture single clicks as starting dots
      ctx.beginPath();
      ctx.moveTo(startAction.x, startAction.y);
      ctx.lineTo(startAction.x, startAction.y);
      ctx.stroke();

      let prevPoint = { x: startAction.x, y: startAction.y };

      // Render line segments
      for (let i = 1; i < stroke.actions.length; i++) {
        const action = stroke.actions[i];
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(action.x, action.y);
        ctx.stroke();
        prevPoint = { x: action.x, y: action.y };
      }
    });
  };

  // Drawing callback for local mouse/touch movements (only runs if enabled)
  const onDraw = ({ prevPoint, currentPoint, ctx }: { prevPoint: Point | null; currentPoint: Point; ctx: CanvasRenderingContext2D }) => {
    // 1. Render line locally
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(prevPoint ? prevPoint.x : currentPoint.x, prevPoint ? prevPoint.y : currentPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    // 2. Transmit coordinates and record to local stroke history
    if (!prevPoint) {
      const stroke: Stroke = {
        actions: [{ x: currentPoint.x, y: currentPoint.y, color, size: brushSize }]
      };
      currentStrokeRef.current = stroke;

      socket.emit('draw_start', {
        x: currentPoint.x,
        y: currentPoint.y,
        color,
        size: brushSize,
      });
    } else {
      if (currentStrokeRef.current) {
        currentStrokeRef.current.actions.push({ x: currentPoint.x, y: currentPoint.y });
      }

      socket.emit('draw_move', {
        x: currentPoint.x,
        y: currentPoint.y,
      });
    }
  };

  // Bind our custom drawing hook
  const { canvasRef } = useDraw({
    onDraw,
    enabled: isMeDrawing,
  });

  // Emit draw_end when drawing finishes and save the local stroke
  useEffect(() => {
    if (!isMeDrawing) return;

    const handleStrokeEnd = () => {
      if (currentStrokeRef.current) {
        strokesHistoryRef.current.push(currentStrokeRef.current);
        currentStrokeRef.current = null;
      }
      socket.emit('draw_end');
    };

    window.addEventListener('mouseup', handleStrokeEnd);
    window.addEventListener('touchend', handleStrokeEnd);

    return () => {
      window.removeEventListener('mouseup', handleStrokeEnd);
      window.removeEventListener('touchend', handleStrokeEnd);
    };
  }, [isMeDrawing]);

  // Effect to handle remote drawing events and clear/undo synchronizations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleRemoteStroke = (payload: { type: string; x?: number; y?: number; color?: string; size?: number }) => {
      const { type, x, y, color: strokeColor, size: strokeSize } = payload;

      // Authoritative clear synchronizer
      if (type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokesHistoryRef.current = [];
        currentStrokeRef.current = null;
        remoteCurrentStrokeRef.current = null;
        remotePrevPointRef.current = null;
        return;
      }

      // Authoritative undo synchronizer
      if (type === 'undo') {
        strokesHistoryRef.current.pop();
        redrawCanvas();
        return;
      }

      // Ignore normal drawing segments if I am drawing (already drawn locally)
      if (isMeDrawing) return;

      if (type === 'start' && x !== undefined && y !== undefined) {
        remotePrevPointRef.current = { x, y };

        const stroke: Stroke = {
          actions: [{ x, y, color: strokeColor, size: strokeSize }]
        };
        remoteCurrentStrokeRef.current = stroke;
        
        // Draw a tiny dot on start to capture single clicks
        ctx.strokeStyle = strokeColor || '#000000';
        ctx.lineWidth = strokeSize || 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } 
      
      else if (type === 'move' && x !== undefined && y !== undefined) {
        const startX = remotePrevPointRef.current ? remotePrevPointRef.current.x : x;
        const startY = remotePrevPointRef.current ? remotePrevPointRef.current.y : y;

        if (remoteCurrentStrokeRef.current) {
          remoteCurrentStrokeRef.current.actions.push({ x, y });
        }

        ctx.strokeStyle = strokeColor || '#000000';
        ctx.lineWidth = strokeSize || 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();

        remotePrevPointRef.current = { x, y };
      } 
      
      else if (type === 'end') {
        remotePrevPointRef.current = null;
        if (remoteCurrentStrokeRef.current) {
          strokesHistoryRef.current.push(remoteCurrentStrokeRef.current);
          remoteCurrentStrokeRef.current = null;
        }
      }
    };

    socket.on('draw_data', handleRemoteStroke);

    return () => {
      socket.off('draw_data', handleRemoteStroke);
    };
  }, [canvasRef, isMeDrawing]);

  // Clean the canvas and clear history locally when drawer switches
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      strokesHistoryRef.current = [];
      currentStrokeRef.current = null;
      remoteCurrentStrokeRef.current = null;
      remotePrevPointRef.current = null;
    }
  }, [gameState.drawerId, canvasRef]);

  const activeDrawerName = players.find(p => p.id === gameState.drawerId)?.name || 'Someone';

  const getBannerText = () => {
    if (gameState.phase === 'selecting_word') {
      return gameState.drawerId === (socketId || socket.id)
        ? '🎨 You are choosing a word...'
        : `🎨 ${activeDrawerName} is choosing a word...`;
    }
    if (gameState.phase === 'drawing') {
      return isMeDrawing ? '🎨 You are drawing!' : `🖌️ ${activeDrawerName} is drawing...`;
    }
    if (gameState.phase === 'round_end') {
      return '⏰ Round ended!';
    }
    if (gameState.phase === 'game_over') {
      return '🏆 Game Over!';
    }
    return '';
  };

  return (
    <div className={styles.canvasContainer}>
      <div className={styles.drawerBanner}>
        <div className={styles.bannerIndicator}></div>
        <span>
          {getBannerText()}
        </span>
      </div>

      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={800} // Fixed logical coordinate width
          height={600} // Fixed logical coordinate height
          className={`${styles.canvasElement} ${!isMeDrawing ? styles.canvasDisabled : ''}`}
        />
      </div>
    </div>
  );
}
