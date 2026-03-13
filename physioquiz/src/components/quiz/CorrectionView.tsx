'use client';

import type { CorrectionData } from '@/hooks/useQuiz';
import DOMPurify from 'isomorphic-dompurify';
import { memo } from 'react';

interface CorrectionViewProps {
  correction: CorrectionData;
  selectedCount: number;
}

export default memo(function CorrectionView({
  correction,
  selectedCount,
}: CorrectionViewProps) {
  const {
    is_correct,
    is_partially_correct,
    score_percent,
    correct_choice_ids,
    explanation_html,
  } = correction;

  const totalCorrect = correct_choice_ids.length;
  const correctSelected =
    totalCorrect > 0 ? Math.round((score_percent / 100) * totalCorrect) : 0;

  return (
    <div
      className="mt-4 animate-fade-in rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6"
      aria-live="polite"
    >
      {/* Score feedback */}
      <div className="mb-4">
        {is_correct && (
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-50 text-secondary-500">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
            <span className="text-sm font-semibold text-secondary-500">
              Bonne réponse !
            </span>
          </div>
        )}

        {is_partially_correct && (
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 font-bold text-warning">
              ~
            </span>
            <span className="text-sm font-semibold text-warning">
              Vous avez trouvé {correctSelected}/{totalCorrect} bonnes réponses
              ({score_percent}%)
            </span>
          </div>
        )}

        {!is_correct && !is_partially_correct && (
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-error">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </span>
            <span className="text-sm font-semibold text-error">
              {selectedCount > 0
                ? 'Mauvaise réponse.'
                : 'Aucune réponse sélectionnée.'}
            </span>
          </div>
        )}
      </div>

      {/* Explanation */}
      {explanation_html && (
        <div className="border-t border-neutral-200 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Explication
          </p>
          <div
            className="prose prose-sm max-w-none text-neutral-700"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(explanation_html),
            }}
          />
        </div>
      )}
    </div>
  );
});
