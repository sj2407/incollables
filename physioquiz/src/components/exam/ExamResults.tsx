'use client';

import { Check, X as XIcon, Square, CaretDown } from '@phosphor-icons/react';
import type { ExamQuestionResult, ExamResults as ExamResultsType } from '@/hooks/useExam';
import DOMPurify from 'isomorphic-dompurify';
import Link from 'next/link';
import { useState } from 'react';
import ScoreCircle from '@/components/ui/ScoreCircle';

interface ExamResultsProps {
  results: ExamResultsType;
  topicId: string;
}

export default function ExamResultsView({ results, topicId }: ExamResultsProps) {
  const {
    score_percent,
    duration_seconds,
    time_limit_seconds,
    correct_count,
    wrong_count,
    partial_count,
    unanswered_count,
    question_count,
    results: questionResults,
  } = results;

  // Duration formatting
  const durationMin = Math.floor(duration_seconds / 60);
  const durationSec = duration_seconds % 60;
  const timeLimitMin = time_limit_seconds ? Math.floor(time_limit_seconds / 60) : null;

  // Questions to review (incorrect + partial + unanswered)
  const reviewQuestions = questionResults.filter(
    (q) => !q.is_correct,
  );

  return (
    <div className="mx-auto max-w-2xl">
      {/* Score header */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-md sm:p-8" aria-live="polite">
        <h1 className="mb-2 text-lg font-bold text-neutral-900 sm:text-xl">
          Résultat de l&apos;examen blanc
        </h1>
        <div className="flex justify-center">
          <ScoreCircle score={score_percent} size={96} strokeWidth={4} fontSize={28} />
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {correct_count}/{question_count} correctes
        </p>

        {/* Duration */}
        <p className="mt-3 text-sm text-neutral-500">
          Durée : {durationMin} min {String(durationSec).padStart(2, '0')} s
          {timeLimitMin !== null && ` / ${timeLimitMin} min`}
        </p>
      </div>

      {/* Stats breakdown */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBadge label="Correctes" value={correct_count} color="bg-secondary-50 text-secondary-500" />
        <StatBadge label="Partielles" value={partial_count} color="bg-amber-50 text-warning" />
        <StatBadge label="Incorrectes" value={wrong_count - unanswered_count} color="bg-red-50 text-error" />
        <StatBadge label="Non répondues" value={unanswered_count} color="bg-neutral-100 text-neutral-500" />
      </div>

      {/* Review section */}
      {reviewQuestions.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-neutral-900 sm:text-lg">
            Revue des erreurs ({reviewQuestions.length})
          </h2>
          <div className="flex flex-col gap-3">
            {reviewQuestions.map((q) => (
              <ReviewCard key={q.question_id} question={q} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/exam/setup/${topicId}`}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          Refaire cet examen
        </Link>
        <Link
          href="/practice"
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          Retour
        </Link>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

function ReviewCard({ question }: { question: ExamQuestionResult }) {
  const [expanded, setExpanded] = useState(false);

  let statusIcon: React.ReactNode;
  let statusColor: string;

  if (question.is_unanswered) {
    statusIcon = <Square size={16} className="text-neutral-400" />;
    statusColor = 'text-neutral-500';
  } else if (question.is_partially_correct) {
    statusIcon = <span className="text-warning">~</span>;
    statusColor = 'text-warning';
  } else {
    statusIcon = <XIcon size={16} weight="bold" className="text-error" />;
    statusColor = 'text-error';
  }

  const correctSet = new Set(question.correct_choice_ids);
  const selectedSet = new Set(question.selected_choice_ids);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-md">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`Question ${question.question_number ?? ''} — ${expanded ? 'réduire' : 'développer'}`}
        className="flex min-h-[44px] w-full items-center gap-3 p-4 text-left"
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg font-bold ${statusColor}`}>
          {statusIcon}
        </span>
        <span className="flex-1 text-sm text-neutral-700 line-clamp-2">
          {question.question_number ? `Q${question.question_number}. ` : ''}
          {question.question_text}
        </span>
        <span className={`shrink-0 text-xs font-semibold ${statusColor}`}>
          {question.is_unanswered ? 'N/R' : `${Math.round(question.score_percent)}%`}
        </span>
        <CaretDown
          size={16}
          className={`shrink-0 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="animate-fade-in border-t border-neutral-200 p-4">
          {/* Choices with coloring */}
          <div className="mb-4 flex flex-col gap-2">
            {[...question.choices]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((choice) => {
                const isCorrect = correctSet.has(choice.id);
                const isSelected = selectedSet.has(choice.id);

                let borderColor = 'border-neutral-200';
                let bgColor = 'bg-white';

                if (isSelected && isCorrect) {
                  borderColor = 'border-secondary-500';
                  bgColor = 'bg-secondary-50';
                } else if (isSelected && !isCorrect) {
                  borderColor = 'border-error';
                  bgColor = 'bg-red-50';
                } else if (!isSelected && isCorrect) {
                  borderColor = 'border-secondary-500/50';
                  bgColor = 'bg-secondary-50/50';
                }

                return (
                  <div
                    key={choice.id}
                    className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 text-sm ${borderColor} ${bgColor}`}
                  >
                    <span className="shrink-0 font-semibold text-neutral-500">
                      {choice.label}.
                    </span>
                    <span className="flex-1 text-neutral-700">
                      {choice.choice_text}
                    </span>
                    {isSelected && isCorrect && (
                      <Check size={16} weight="bold" className="shrink-0 text-secondary-500" />
                    )}
                    {isSelected && !isCorrect && (
                      <XIcon size={16} weight="bold" className="shrink-0 text-error" />
                    )}
                    {!isSelected && isCorrect && (
                      <Check size={16} weight="bold" className="shrink-0 text-secondary-500/60" />
                    )}
                  </div>
                );
              })}
          </div>

          {/* Explanation */}
          {question.explanation_html && (
            <div className="border-t border-neutral-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Explication
              </p>
              <div
                className="prose prose-sm max-w-none text-neutral-700"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(question.explanation_html),
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

