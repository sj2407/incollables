'use client';

import type { CorrectionData } from '@/hooks/useQuiz';
import DOMPurify from 'isomorphic-dompurify';
import { memo } from 'react';

interface CorrectionViewProps {
  correction: CorrectionData;
}

export default memo(function CorrectionView({
  correction,
}: CorrectionViewProps) {
  const { explanation_html, is_correct, is_partially_correct } = correction;

  // No explanation → don't render anything (choice color coding is enough)
  if (!explanation_html) return null;

  const borderColor = is_correct
    ? 'border-l-secondary-500'
    : is_partially_correct
      ? 'border-l-warning'
      : 'border-l-error';

  return (
    <div
      className={`mt-4 animate-correction-slide-in glass-card border-l-4 ${borderColor} p-4 sm:p-6`}
      aria-live="polite"
    >
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
  );
});
