'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';

interface CountdownProps {
  /** Exam start time (ISO string from server) */
  startedAt: string;
  /** Time limit in seconds */
  timeLimitSeconds: number;
  /** Called when time reaches 0 */
  onTimeUp: () => void;
  /** Called when 5 minutes remain (once) */
  onWarning?: () => void;
}

export default memo(function Countdown({
  startedAt,
  timeLimitSeconds,
  onTimeUp,
  onWarning,
}: CountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
    return Math.max(0, Math.ceil(timeLimitSeconds - elapsed));
  });

  const warningFiredRef = useRef(false);
  const timeUpFiredRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  const onWarningRef = useRef(onWarning);
  onTimeUpRef.current = onTimeUp;
  onWarningRef.current = onWarning;

  const computeRemaining = useCallback(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
    return Math.max(0, Math.ceil(timeLimitSeconds - elapsed));
  }, [startedAt, timeLimitSeconds]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setRemainingSeconds(remaining);

      // 5-minute warning
      if (remaining <= 300 && remaining > 0 && !warningFiredRef.current) {
        warningFiredRef.current = true;
        onWarningRef.current?.();
      }

      // Time's up
      if (remaining <= 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        clearInterval(interval);
        onTimeUpRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [computeRemaining]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = remainingSeconds <= 300;

  return (
    <span
      className={`text-sm font-semibold tabular-nums ${
        isUrgent ? 'text-error' : 'text-neutral-700'
      }`}
      aria-label={`Temps restant : ${minutes} minutes et ${seconds} secondes`}
      aria-live={isUrgent ? 'assertive' : 'polite'}
    >
      {timeDisplay}
    </span>
  );
});
