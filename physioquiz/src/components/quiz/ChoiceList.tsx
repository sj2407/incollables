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
    <div className="flex flex-col gap-3" role="group" aria-label="Propositions">
      {choices.map((choice) => {
        const isSelected = selectedIds.has(choice.id);
        const isCorrect = correctSet.has(choice.id);

        let borderColor = 'border-neutral-100';
        let bgColor = 'bg-white';
        let animClass = '';
        let icon: React.ReactNode = null;
        let badgeBg = 'bg-neutral-100 text-neutral-500';

        if (isValidated) {
          if (isSelected && isCorrect) {
            borderColor = 'border-secondary-500';
            bgColor = 'bg-secondary-50';
            animClass = 'animate-correct-reveal';
            icon = <CheckIcon className="text-secondary-500" />;
            badgeBg = 'bg-secondary-500 text-white';
          } else if (isSelected && !isCorrect) {
            borderColor = 'border-error';
            bgColor = 'bg-red-50';
            animClass = 'animate-wrong-shake';
            icon = <XIcon className="text-error" />;
            badgeBg = 'bg-error text-white';
          } else if (!isSelected && isCorrect) {
            borderColor = 'border-secondary-500/50';
            bgColor = 'bg-secondary-50/50';
            animClass = 'animate-correct-reveal';
            icon = <CheckIcon className="text-secondary-500/60" />;
            badgeBg = 'bg-secondary-100 text-secondary-600';
          }
        } else if (isSelected) {
          badgeBg = 'bg-primary text-white';
        }

        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => onToggle(choice.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`flex min-h-[44px] items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${borderColor} ${bgColor} ${animClass} ${
              !disabled
                ? isSelected && !isValidated
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50 hover:bg-primary/5'
                : ''
            } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {/* Letter badge */}
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors ${badgeBg}`}
            >
              {isValidated && icon ? icon : choice.label}
            </div>

            {/* Text */}
            <span className="flex-1 text-sm font-semibold text-neutral-700">
              {choice.choice_text}
            </span>

            {/* Check icon when selected (pre-validation) */}
            {isSelected && !isValidated && (
              <CheckIcon className="h-5 w-5 shrink-0 text-primary" />
            )}
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
