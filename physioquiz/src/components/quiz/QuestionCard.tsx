'use client';

import { Pause } from '@phosphor-icons/react';
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
    <div className="animate-slide-in-right">
      {/* Progress section */}
      <div className="mb-3 glass-card px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-base font-bold text-neutral-900">
            Question {currentIndex + 1} <span className="text-neutral-300 font-medium text-sm">/ {totalQuestions}</span>
          </h2>
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
                className="min-h-[44px] rounded-2xl px-2 py-1 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-600 disabled:text-neutral-300"
              >
                {isPausing ? 'Pause...' : <><Pause size={16} weight="bold" className="mr-1 inline" />Pause</>}
              </button>
            )}
            <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
          </div>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
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
      <div className="space-y-3 pl-2.5 pr-10">
        <h3 className="text-base font-bold leading-snug text-neutral-900 md:text-lg">
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
