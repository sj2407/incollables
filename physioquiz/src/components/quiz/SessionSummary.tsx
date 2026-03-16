'use client';

import DOMPurify from 'isomorphic-dompurify';
import Link from 'next/link';
import { useState } from 'react';

interface AnswerDetail {
  question_id: string;
  question_text: string;
  question_number: number | null;
  is_correct: boolean;
  is_partially_correct: boolean;
  score_percent: number;
  correct_choice_ids: string[];
  selected_choice_ids: string[];
  choices: {
    id: string;
    label: string;
    choice_text: string;
    is_correct: boolean;
  }[];
  explanation_html: string | null;
}

interface SessionSummaryProps {
  topicId: string;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  partialCount: number;
  scorePercent: number;
  durationSeconds: number | null;
  answers: AnswerDetail[];
}

function getScoreColor(percent: number): string {
  if (percent >= 75) return 'text-secondary-500';
  if (percent >= 40) return 'text-warning';
  return 'text-error';
}

export default function SessionSummary({
  topicId,
  questionCount,
  correctCount,
  wrongCount,
  partialCount,
  scorePercent,
  durationSeconds,
  answers,
}: SessionSummaryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const avgTimePerQuestion =
    durationSeconds && questionCount > 0
      ? Math.round(durationSeconds / questionCount)
      : null;

  // Compute average score from individual answers (more accurate than stored value)
  const computedAvgScore =
    answers.length > 0
      ? Math.round((answers.reduce((sum, a) => sum + a.score_percent, 0) / answers.length) * 10) / 10
      : scorePercent;

  const failedAnswers = answers
    .filter((a) => !a.is_correct)
    .sort((a, b) => a.score_percent - b.score_percent);
  const failedQuestionIds = failedAnswers.map((a) => a.question_id);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Score card */}
      <div className="animate-fade-in rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-md sm:p-6">
        <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
          Résultats de la session
        </h1>

        <p className={`mt-4 text-4xl font-bold ${getScoreColor(computedAvgScore)}`}>
          {computedAvgScore}%
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {correctCount}/{questionCount} correctes
        </p>

        {/* Stats row */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <StatBadge
            label="Correctes"
            count={correctCount}
            colorClass="text-secondary-500 bg-secondary-50"
          />
          <StatBadge
            label="Partielles"
            count={partialCount}
            colorClass="text-warning bg-amber-50"
          />
          <StatBadge
            label="Incorrectes"
            count={wrongCount}
            colorClass="text-error bg-red-50"
          />
        </div>

        {/* Duration */}
        {durationSeconds !== null && (
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-neutral-500">
            <span>Durée : {formatDuration(durationSeconds)}</span>
            {avgTimePerQuestion !== null && (
              <span>Moy. : {avgTimePerQuestion}s / question</span>
            )}
          </div>
        )}
      </div>

      {/* Failed & partial questions */}
      {failedAnswers.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
            Questions à revoir ({failedAnswers.length})
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {failedAnswers.map((answer) => (
              <AnswerReviewCard
                key={answer.question_id}
                answer={answer}
                isExpanded={expandedId === answer.question_id}
                onToggle={() =>
                  setExpandedId(
                    expandedId === answer.question_id
                      ? null
                      : answer.question_id,
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {failedAnswers.length > 0 && (
          <Link
            href={`/quiz/setup/${topicId}?retry=${encodeURIComponent(failedQuestionIds.join(','))}`}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-700 active:scale-[0.97]"
          >
            Recommencer les ratées
          </Link>
        )}
        <Link
          href="/stats"
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-primary-200 bg-white px-5 py-3 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary-50 active:scale-[0.97]"
        >
          Voir ma progression
        </Link>
        <Link
          href="/practice"
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 py-3 text-center text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 active:scale-[0.97]"
        >
          Retour aux cours
        </Link>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${colorClass}`}
      >
        {count}
      </span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

function AnswerReviewCard({
  answer,
  isExpanded,
  onToggle,
}: {
  answer: AnswerDetail;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const selectedSet = new Set(answer.selected_choice_ids);
  const correctSet = new Set(answer.correct_choice_ids);
  const sortedChoices = [...answer.choices].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-md">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`Voir la correction pour ${answer.question_number ? `Q${answer.question_number}` : 'cette question'}`}
        className="flex min-h-[44px] w-full items-center gap-3 p-3 text-left sm:p-4"
      >
        {/* Status icon */}
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            answer.is_partially_correct
              ? 'bg-amber-50 text-warning'
              : 'bg-red-50 text-error'
          }`}
          aria-hidden="true"
        >
          {answer.is_partially_correct ? '~' : '✗'}
        </span>
        <span className="sr-only">
          {answer.is_partially_correct ? 'Partielle' : 'Incorrecte'}
        </span>

        {/* Question text (truncated) */}
        <span className="flex-1 truncate text-sm text-neutral-700">
          {answer.question_number ? `Q${answer.question_number}. ` : ''}
          {answer.question_text}
        </span>

        {/* Score */}
        <span className="shrink-0 text-xs font-medium text-neutral-400">
          {answer.score_percent}%
        </span>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-neutral-200 p-3 sm:p-4">
          {/* Choices with coloring */}
          <div className="flex flex-col gap-1.5">
            {sortedChoices.map((choice) => {
              const wasSelected = selectedSet.has(choice.id);
              const isCorrectChoice = correctSet.has(choice.id);

              let bg = '';
              let textColor = 'text-neutral-700';
              if (wasSelected && isCorrectChoice) {
                bg = 'bg-secondary-50';
                textColor = 'text-secondary-700';
              } else if (wasSelected && !isCorrectChoice) {
                bg = 'bg-red-50';
                textColor = 'text-error';
              } else if (!wasSelected && isCorrectChoice) {
                bg = 'bg-secondary-50/50';
                textColor = 'text-secondary-600/70';
              }

              return (
                <div
                  key={choice.id}
                  className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${bg} ${textColor}`}
                >
                  <span className="shrink-0 font-semibold">
                    {choice.label}.
                  </span>
                  <span className="flex-1">{choice.choice_text}</span>
                  {wasSelected && isCorrectChoice && (
                    <span className="text-xs text-secondary-500" aria-label="Correcte">✓</span>
                  )}
                  {wasSelected && !isCorrectChoice && (
                    <span className="text-xs text-error" aria-label="Incorrecte">✗</span>
                  )}
                  {!wasSelected && isCorrectChoice && (
                    <span className="text-xs text-secondary-500/60" aria-label="Bonne réponse manquée">✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {answer.explanation_html && (
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Explication
              </p>
              <div
                className="prose prose-sm max-w-none text-neutral-700"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(answer.explanation_html),
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}min ${String(s).padStart(2, '0')}s`;
}
