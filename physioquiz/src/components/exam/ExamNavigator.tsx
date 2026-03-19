'use client';

import { memo } from 'react';

interface ExamNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  /** Set of question indices that have been answered */
  answeredIndices: Set<number>;
  /** Set of question indices that are flagged */
  flaggedIndices: Set<number>;
  onGoTo: (index: number) => void;
}

export default memo(function ExamNavigator({
  totalQuestions,
  currentIndex,
  answeredIndices,
  flaggedIndices,
  onGoTo,
}: ExamNavigatorProps) {
  return (
    <div className="glass-card p-4 sm:p-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Navigation rapide
      </p>

      {/* Question grid */}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: totalQuestions }, (_, i) => {
          const isAnswered = answeredIndices.has(i);
          const isFlagged = flaggedIndices.has(i);
          const isCurrent = i === currentIndex;

          let bgColor = 'bg-neutral-100 text-neutral-500'; // unanswered
          if (isAnswered) bgColor = 'bg-primary-100 text-primary-700'; // answered
          if (isCurrent) bgColor = 'bg-primary text-white'; // current

          return (
            <button
              key={i}
              type="button"
              onClick={() => onGoTo(i)}
              aria-label={`Question ${i + 1}${isAnswered ? ', répondue' : ', non répondue'}${isFlagged ? ', marquée' : ''}${isCurrent ? ', actuelle' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              className={`relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-xs font-semibold transition-colors ${bgColor} hover:opacity-80`}
            >
              {i + 1}
              {isFlagged && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary-100" aria-hidden="true" />
          Répondue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-neutral-100" aria-hidden="true" />
          Non répondue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative inline-block h-3 w-3 rounded-sm bg-neutral-100" aria-hidden="true">
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning" />
          </span>
          Marquée
        </span>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.totalQuestions === next.totalQuestions &&
    prev.currentIndex === next.currentIndex &&
    prev.answeredIndices === next.answeredIndices &&
    prev.flaggedIndices === next.flaggedIndices &&
    prev.onGoTo === next.onGoTo
  );
});
