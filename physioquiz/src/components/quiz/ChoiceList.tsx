'use client';

import type { SafeChoice } from '@/types';
import { memo } from 'react';

interface ChoiceListProps {
  choices: SafeChoice[];
  selectedIds: Set<string>;
  onToggle: (choiceId: string) => void;
  disabled: boolean;
  /** After validation: IDs of the correct choices (from server response) */
  correctChoiceIds?: string[];
}

function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  const arr = Array.from(a);
  for (let i = 0; i < arr.length; i++) {
    if (!b.has(arr[i])) return false;
  }
  return true;
}

function areArraysEqual(a?: string[], b?: string[]): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default memo(function ChoiceList({
  choices,
  selectedIds,
  onToggle,
  disabled,
  correctChoiceIds,
}: ChoiceListProps) {
  const isValidated = correctChoiceIds !== undefined;
  const correctSet = new Set(correctChoiceIds ?? []);

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Propositions">
      {choices.map((choice) => {
        const isSelected = selectedIds.has(choice.id);
        const isCorrect = correctSet.has(choice.id);

        let borderColor = 'border-neutral-200';
        let bgColor = 'bg-white';
        let animClass = '';
        let icon: React.ReactNode = null;

        if (isValidated) {
          if (isSelected && isCorrect) {
            // Correct + checked → green
            borderColor = 'border-secondary-500';
            bgColor = 'bg-secondary-50';
            animClass = 'animate-correct-reveal';
            icon = <CheckIcon className="text-secondary-500" />;
          } else if (isSelected && !isCorrect) {
            // Incorrect + checked → red
            borderColor = 'border-error';
            bgColor = 'bg-red-50';
            animClass = 'animate-wrong-shake';
            icon = <XIcon className="text-error" />;
          } else if (!isSelected && isCorrect) {
            // Correct + not checked → pale green
            borderColor = 'border-secondary-500/50';
            bgColor = 'bg-secondary-50/50';
            animClass = 'animate-correct-reveal';
            icon = <CheckIcon className="text-secondary-500/60" />;
          }
        }

        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => onToggle(choice.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`flex min-h-[44px] items-center gap-3 rounded-lg border-2 px-3 py-3 text-left transition-colors sm:px-4 ${borderColor} ${bgColor} ${animClass} ${
              !disabled
                ? isSelected
                  ? 'border-primary-500 bg-primary-50'
                  : 'hover:border-primary-200 hover:bg-primary-50/50'
                : ''
            } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {/* Checkbox indicator */}
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                isSelected && !isValidated
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : isValidated && icon
                    ? 'border-transparent'
                    : 'border-neutral-300'
              }`}
            >
              {isValidated ? (
                icon
              ) : isSelected ? (
                <svg
                  className="h-3 w-3"
                  fill="currentColor"
                  viewBox="0 0 12 12"
                >
                  <path d="M10.28 2.28a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0L1.72 6.34a.75.75 0 1 1 1.06-1.06L4.5 7l4.72-4.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              ) : null}
            </span>

            {/* Label */}
            <span className="shrink-0 text-sm font-semibold text-neutral-500">
              {choice.label}.
            </span>

            {/* Text */}
            <span className="flex-1 text-sm text-neutral-700 sm:text-base">
              {choice.choice_text}
            </span>
          </button>
        );
      })}
    </div>
  );
}, (prev, next) => {
  return (
    prev.choices === next.choices &&
    areSetsEqual(prev.selectedIds, next.selectedIds) &&
    prev.onToggle === next.onToggle &&
    prev.disabled === next.disabled &&
    areArraysEqual(prev.correctChoiceIds, next.correctChoiceIds)
  );
});

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 ${className ?? ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 ${className ?? ''}`}
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
  );
}
