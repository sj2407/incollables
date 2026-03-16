'use client';

import type { QuizQuestion } from '@/hooks/useQuiz';
import { memo } from 'react';

interface QuestionCardProps {
  question: QuizQuestion;
  currentIndex: number;
  totalQuestions: number;
  elapsedSeconds: number;
  progress: number;
  showTimer?: boolean;
  canPause?: boolean;
  isPausing?: boolean;
  onPause?: () => void;
}

export default memo(function QuestionCard({
  question,
  currentIndex,
  totalQuestions,
  elapsedSeconds,
  progress,
  showTimer = false,
  canPause,
  isPausing,
  onPause,
}: QuestionCardProps) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div>
      {/* Progress section */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Progression</p>
            <h2 className="text-2xl font-bold text-neutral-900">
              Question {currentIndex + 1} <span className="text-neutral-300 font-medium">/ {totalQuestions}</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {showTimer && (
              <span className="text-sm font-bold tabular-nums text-primary" aria-label={`Temps écoulé : ${timeDisplay}`}>
                {timeDisplay}
              </span>
            )}
            {canPause && onPause && (
              <button
                type="button"
                onClick={onPause}
                disabled={isPausing}
                aria-label="Mettre en pause"
                className="min-h-[44px] rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:text-neutral-400"
              >
                {isPausing ? 'Pause...' : '⏸ Pause'}
              </button>
            )}
            <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
          </div>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-neutral-200"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progression : ${Math.round(progress)}%`}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, boxShadow: '0 0 12px rgba(25,76,230,0.3)' }}
          />
        </div>
      </div>

      {/* Question text */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold leading-snug text-neutral-900 md:text-2xl">
          {question.question_text}
        </h3>

        {/* Stem images */}
        {question.question_images.length > 0 && (
          <div className="flex flex-col gap-3">
            {question.question_images.map((img) => (
              <QuestionImage key={img.id} src={img.storage_path} alt={img.original_name} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function QuestionImage({ src, alt }: { src: string; alt: string | null }) {
  // Using <img> intentionally: images come from Supabase Storage with dynamic URLs
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? 'Image de la question'} className="max-w-full rounded-lg" loading="lazy" />;
}
