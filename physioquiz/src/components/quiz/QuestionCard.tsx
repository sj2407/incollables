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
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
      {/* Header: progress + timer + pause */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">
          Question {currentIndex + 1}/{totalQuestions}
        </span>
        <div className="flex items-center gap-3">
          {showTimer && (
            <span className="text-sm tabular-nums text-neutral-500" aria-label={`Temps écoulé : ${timeDisplay}`}>
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
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression : ${Math.round(progress)}%`}
      >
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question text */}
      <p className="text-[0.9375rem] font-medium leading-relaxed text-neutral-900 sm:text-[1.0625rem]">
        {question.question_text}
      </p>

      {/* Stem images */}
      {question.question_images.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {question.question_images.map((img) => (
              <QuestionImage key={img.id} src={img.storage_path} alt={img.original_name} />
            ))}
        </div>
      )}
    </div>
  );
});

function QuestionImage({ src, alt }: { src: string; alt: string | null }) {
  // Using <img> intentionally: images come from Supabase Storage with dynamic URLs
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? 'Image de la question'} className="max-w-full rounded-lg" loading="lazy" />;
}
