'use client';

import { useEffect, useRef, useState } from 'react';

export interface Point {
  x: number;
  y: number;
}

interface UseDrawProps {
  onDraw: (payload: { prevPoint: Point | null; currentPoint: Point; ctx: CanvasRenderingContext2D }) => void;
  enabled: boolean;
}

export function useDraw({ onDraw, enabled }: UseDrawProps) {
  const [mouseDown, setMouseDown] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPoint = useRef<Point | null>(null);

  // Helper to get coordinates relative to the canvas bounding box
  const getCoordinates = (e: MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Check if touch event or mouse event
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return {
        x: (e.touches[0].clientX - rect.left) * (canvas.width / rect.width),
        y: (e.touches[0].clientY - rect.top) * (canvas.height / rect.height),
      };
    } else {
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mouse handlers
    const handleStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      setMouseDown(true);
      const point = getCoordinates(e);
      if (point) {
        prevPoint.current = point;
        onDraw({ prevPoint: null, currentPoint: point, ctx });
      }
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!mouseDown) return;
      e.preventDefault();
      
      const point = getCoordinates(e);
      if (point && prevPoint.current) {
        onDraw({ prevPoint: prevPoint.current, currentPoint: point, ctx });
        prevPoint.current = point;
      }
    };

    const handleEnd = () => {
      setMouseDown(false);
      prevPoint.current = null;
    };

    // Bind event listeners
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    
    // Touch event listeners for mobile support
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    // Clean up event listeners on unmount or when drawing is disabled
    return () => {
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);

      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [onDraw, mouseDown, enabled]);

  return { canvasRef };
}
