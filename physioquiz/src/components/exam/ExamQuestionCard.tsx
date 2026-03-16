'use client';

import type { ExamQuestion } from '@/hooks/useExam';
import { memo } from 'react';

interface ExamQuestionCardProps {
  question: ExamQuestion;
  currentIndex: number;
  totalQuestions: number;
  progress: number;
}

export default memo(function ExamQuestionCard({
  question,
  currentIndex,
  totalQuestions,
  progress,
}: ExamQuestionCardProps) {
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
          <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.storage_path}
                alt={img.original_name ?? 'Image de la question'}
                className="max-w-full rounded-lg"
                loading="lazy"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
