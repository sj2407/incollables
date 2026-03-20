'use client';

import { Check, X as XIcon, CaretRight } from '@phosphor-icons/react';
import DOMPurify from 'isomorphic-dompurify';
import Link from 'next/link';
import { useState } from 'react';
import ScoreCircle from '@/components/ui/ScoreCircle';
import StaggerList from '@/components/ui/StaggerList';

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
      <div className="animate-fade-in glass-card-inner p-3 text-center sm:p-4">
        <h1 className="text-base font-bold text-neutral-900 sm:text-lg">
          Résultats de la session
        </h1>

        <div className="mt-3 flex justify-center">
          <ScoreCircle score={computedAvgScore} size={80} strokeWidth={3.5} fontSize={24} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {correctCount}/{questionCount} correctes
        </p>

        {/* Stats row */}
        <div className="mt-4 flex items-center justify-center gap-5">
          <StatBadge label="Correctes" count={correctCount} colorClass="text-secondary-500 bg-secondary-50" />
          <StatBadge label="Partielles" count={partialCount} colorClass="text-warning bg-amber-50" />
          <StatBadge label="Incorrectes" count={wrongCount} colorClass="text-error bg-red-50" />
        </div>

        {/* Duration */}
        {durationSeconds !== null && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-500">
            <span>Durée : {formatDuration(durationSeconds)}</span>
            {avgTimePerQuestion !== null && (
              <span>Moy. : {avgTimePerQuestion}s / question</span>
            )}
          </div>
        )}
      </div>

      {/* Failed & partial questions — scrollable */}
      {failedAnswers.length > 0 && (
        <div className="mt-5">
          <h2 className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
            Questions à revoir ({failedAnswers.length})
          </h2>
          <div className="relative mt-3">
            <div className="max-h-[260px] overflow-y-auto rounded-xl">
              <StaggerList className="flex flex-col gap-1.5 p-2" staggerDelay={0.06} duration={0.35}>
                {failedAnswers.map((answer) => (
                  <AnswerReviewCard
                    key={answer.question_id}
                    answer={answer}
                    isExpanded={expandedId === answer.question_id}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === answer.question_id ? null : answer.question_id,
                      )
                    }
                  />
                ))}
              </StaggerList>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons — single row */}
      <div className="mt-5 flex items-center justify-end gap-2">
        <Link
          href="/stats"
          className="min-h-[44px] rounded-2xl glass-btn-secondary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-50"
        >
          Progression
        </Link>
        {failedAnswers.length > 0 && (
          <Link
            href={`/quiz/setup/${topicId}?retry=${encodeURIComponent(failedQuestionIds.join(','))}`}
            className="min-h-[44px] rounded-2xl bg-primary glass-btn px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Recommencer les ratées
          </Link>
        )}
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
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${colorClass}`}
      >
        {count}
      </span>
      <span className="text-[10px] text-neutral-500">{label}</span>
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
    <div className="glass-card-scroll">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`Voir la correction pour ${answer.question_number ? `Q${answer.question_number}` : 'cette question'}`}
        className="flex min-h-[44px] w-full items-center gap-2.5 p-2.5 text-left"
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
          {answer.is_partially_correct ? '~' : <XIcon size={14} weight="bold" />}
        </span>
        <span className="sr-only">
          {answer.is_partially_correct ? 'Partielle' : 'Incorrecte'}
        </span>

        <span className="flex-1 truncate text-sm text-neutral-700">
          {answer.question_number ? `Q${answer.question_number}. ` : ''}
          {answer.question_text}
        </span>

        <span className="shrink-0 text-xs font-medium text-neutral-400">
          {answer.score_percent}%
        </span>

        <CaretRight
          size={14}
          className={`shrink-0 text-neutral-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div className="border-t border-white/40 p-2.5">
          <div className="flex flex-col gap-1">
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
                    <Check size={14} weight="bold" className="text-secondary-500" aria-label="Correcte" />
                  )}
                  {wasSelected && !isCorrectChoice && (
                    <XIcon size={14} weight="bold" className="text-error" aria-label="Incorrecte" />
                  )}
                  {!wasSelected && isCorrectChoice && (
                    <Check size={14} weight="bold" className="text-secondary-500/60" aria-label="Bonne réponse manquée" />
                  )}
                </div>
              );
            })}
          </div>

          {answer.explanation_html && (
            <div className="mt-2 border-t border-white/40 pt-2">
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
