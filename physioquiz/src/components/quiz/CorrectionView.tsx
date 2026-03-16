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
}: CorrectionViewProps) {
  const { explanation_html } = correction;

  // No explanation → don't render anything (choice color coding is enough)
  if (!explanation_html) return null;

  return (
    <div
      className="mt-4 animate-fade-in rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6"
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
