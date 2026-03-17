'use client';

import { Play } from '@phosphor-icons/react';
import { useState } from 'react';

export interface PausedSession {
  id: string;
  topic_title: string;
  question_count: number;
  answered_count: number;
  paused_at: string;
  is_abandoned: boolean;
}

export function PausedSessionCard({
  session,
  onResume,
}: {
  session: PausedSession;
  onResume: () => void;
}) {
  const [resuming, setResuming] = useState(false);
  const progressPercent =
    session.question_count > 0
      ? Math.round((session.answered_count / session.question_count) * 100)
      : 0;

  const handleResume = () => {
    setResuming(true);
    onResume();
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {session.topic_title}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {session.answered_count}/{session.question_count} ({progressPercent}%)
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            En pause depuis {formatPauseDuration(session.paused_at)}
          </p>
        </div>
        <div className="shrink-0">
          {session.is_abandoned ? (
            <span className="text-xs font-medium text-error" role="status">
              Session expirée
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResume}
              disabled={resuming}
              aria-label={`Reprendre la session ${session.topic_title}`}
              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {resuming ? 'Reprise...' : <><Play size={14} weight="fill" aria-hidden="true" className="mr-1 inline" />Reprendre</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function formatPauseDuration(pausedAt: string): string {
  if (!pausedAt) return '';
  const diffMs = Date.now() - new Date(pausedAt).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "moins d'1min";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}
