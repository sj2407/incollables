'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onExpire: () => void;
  undoLabel?: string;
  durationMs?: number;
}

export default function UndoToast({
  message,
  onUndo,
  onExpire,
  undoLabel = 'Annuler',
  durationMs = 5000,
}: UndoToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    timerRef.current = setTimeout(() => expireRef.current(), durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [durationMs]);

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onUndo();
  }, [onUndo]);

  return (
    <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 animate-fade-in rounded-xl bg-neutral-900 px-5 py-3 text-sm text-white shadow-lg">
      <div className="flex items-center gap-4">
        <span>{message}</span>
        <button
          type="button"
          onClick={handleUndo}
          className="min-h-[36px] rounded-lg bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30"
        >
          {undoLabel}
        </button>
      </div>
    </div>
  );
}
