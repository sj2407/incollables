'use client';

import { useCallback, useRef } from 'react';

interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeOptions): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    tracking.current = true;
  }, []);

  const onPointerMove = useCallback(() => {
    // No visual feedback needed — just tracking
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!tracking.current) return;
      tracking.current = false;

      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      // Ignore if vertical movement exceeds horizontal (preserve scrolling)
      if (Math.abs(dy) > Math.abs(dx)) return;

      if (dx < -threshold && onSwipeLeft) {
        onSwipeLeft();
      } else if (dx > threshold && onSwipeRight) {
        onSwipeRight();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
