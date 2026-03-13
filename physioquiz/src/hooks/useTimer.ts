'use client';

import { useEffect, useRef, useState } from 'react';

interface UseTimerOptions {
  /** Whether the timer is currently running */
  running: boolean;
  /** Base elapsed seconds (e.g. from a resumed session) */
  baseElapsed?: number;
}

/**
 * Standalone timer hook — manages its own state to avoid
 * triggering re-renders on the parent quiz state.
 */
export function useTimer({ running, baseElapsed = 0 }: UseTimerOptions) {
  const [elapsedSeconds, setElapsedSeconds] = useState(baseElapsed);
  const timerStartRef = useRef(Date.now());
  const baseElapsedRef = useRef(baseElapsed);

  // Single consolidated effect: sync base elapsed AND reset timer start
  // when either baseElapsed changes or running transitions
  useEffect(() => {
    baseElapsedRef.current = baseElapsed;
    setElapsedSeconds(baseElapsed);
    timerStartRef.current = Date.now();
  }, [baseElapsed, running]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      const delta = Math.round((Date.now() - timerStartRef.current) / 1000);
      setElapsedSeconds(baseElapsedRef.current + delta);
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  return elapsedSeconds;
}
