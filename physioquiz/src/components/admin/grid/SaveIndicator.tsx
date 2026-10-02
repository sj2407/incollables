'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SaveIndicator({ status, errorMsg }: { status: SaveStatus; errorMsg: string | null }) {
  if (status === 'idle') return null;
  return (
    <div className="absolute right-4 top-2 z-10 flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs shadow-md animate-fade-in">
      {status === 'saving' && <span className="text-neutral-500">Enregistrement...</span>}
      {status === 'saved' && <span className="text-secondary-500">✓ Enregistré</span>}
      {status === 'error' && <span className="text-error">✗ {errorMsg ?? 'Erreur'}</span>}
    </div>
  );
}

const SAVED_DISPLAY_MS = 2000;
const ERROR_DISPLAY_MS = 5000;

/** Tracks the grid's save status; 'saved' and 'error' auto-reset to 'idle'. */
export function useSaveStatus() {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const showSaveStatus = useCallback((status: SaveStatus, error?: string) => {
    setSaveStatus(status);
    setSaveError(error ?? null);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (status === 'saved' || status === 'error') {
      saveTimerRef.current = setTimeout(
        () => setSaveStatus('idle'),
        status === 'saved' ? SAVED_DISPLAY_MS : ERROR_DISPLAY_MS,
      );
    }
  }, []);

  return { saveStatus, saveError, showSaveStatus };
}
