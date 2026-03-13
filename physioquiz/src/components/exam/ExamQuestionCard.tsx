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
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
      {/* Header: question number */}
      <div className="mb-4">
        <span className="text-sm font-medium text-neutral-700">
          Question {currentIndex + 1}/{totalQuestions}
        </span>
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
  );
});
