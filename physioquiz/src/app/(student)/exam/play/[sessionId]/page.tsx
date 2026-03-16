'use client';

import { useExam } from '@/hooks/useExam';
import Countdown from '@/components/ui/Countdown';
import ExamQuestionCard from '@/components/exam/ExamQuestionCard';
import ExamNavigator from '@/components/exam/ExamNavigator';
import FlagButton from '@/components/exam/FlagButton';
import ChoiceList from '@/components/quiz/ChoiceList';
import ExamResultsView from '@/components/exam/ExamResults';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';


interface ExamPlayPageProps {
  params: { sessionId: string };
}

export default function ExamPlayPage({ params }: ExamPlayPageProps) {
  const { sessionId } = params;
  const exam = useExam(sessionId);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);

  // Build index sets for the navigator
  const answeredIndices = useMemo(() => {
    const set = new Set<number>();
    exam.questions.forEach((q, i) => {
      if ((exam.answersMap.get(q.id)?.size ?? 0) > 0) set.add(i);
    });
    return set;
  }, [exam.questions, exam.answersMap]);

  const flaggedIndices = useMemo(() => {
    const set = new Set<number>();
    exam.questions.forEach((q, i) => {
      if (exam.flaggedIds.has(q.id)) set.add(i);
    });
    return set;
  }, [exam.questions, exam.flaggedIds]);

  const handleToggleChoice = useCallback(
    (choiceId: string) => {
      if (exam.currentQuestion) {
        exam.toggleChoice(exam.currentQuestion.id, choiceId);
      }
    },
    [exam],
  );

  const handleToggleFlag = useCallback(() => {
    if (exam.currentQuestion) {
      exam.toggleFlag(exam.currentQuestion.id);
    }
  }, [exam]);

  const handleTimeUp = useCallback(() => {
    exam.submitExam();
  }, [exam]);

  const handleTimeWarning = useCallback(() => {
    setShowTimeWarning(true);
    // Auto-dismiss after 5 seconds
    setTimeout(() => setShowTimeWarning(false), 5000);
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    setShowConfirmDialog(false);
    exam.submitExam();
  }, [exam]);

  // Fetch topic_id for results page link
  const topicId = exam.questions[0]?.topic_id ?? '';

  // --- Loading ---
  if (exam.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="mt-6 h-64 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
      </div>
    );
  }

  // --- Error ---
  if (exam.error && !exam.currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl">
        <p role="alert" className="text-sm text-error">
          {exam.error}
        </p>
        <Link
          href="/practice"
          className="mt-3 inline-block min-h-[44px] text-sm font-medium text-primary hover:text-primary-700"
        >
          &larr; Retour
        </Link>
      </div>
    );
  }

  // --- Results (after submission) ---
  if (exam.examResults) {
    return <ExamResultsView results={exam.examResults} topicId={topicId} />;
  }

  // --- Submitting ---
  if (exam.isSubmitting) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="mt-12">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-neutral-500">
            Correction en cours...
          </p>
        </div>
      </div>
    );
  }

  if (!exam.currentQuestion) return null;

  const currentIsFlagged = exam.flaggedIds.has(exam.currentQuestion.id);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header: countdown */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {exam.startedAt && exam.timeLimitSeconds && (
            <Countdown
              startedAt={exam.startedAt}
              timeLimitSeconds={exam.timeLimitSeconds}
              onTimeUp={handleTimeUp}
              onWarning={handleTimeWarning}
            />
          )}
        </div>
      </div>

      {/* Time warning toast */}
      {showTimeWarning && (
        <div
          className="mb-4 animate-fade-in rounded-lg border border-error/30 bg-red-50 p-3 text-sm font-medium text-error"
          role="alert"
        >
          Il reste moins de 5 minutes !
        </div>
      )}

      {/* Error (non-blocking) */}
      {exam.error && (
        <p role="alert" className="mb-4 text-sm text-error">
          {exam.error}
        </p>
      )}

      {/* Question card */}
      <ExamQuestionCard
        question={exam.currentQuestion}
        currentIndex={exam.currentIndex}
        totalQuestions={exam.questions.length}
        progress={exam.progress}
      />

      {/* Choices */}
      <div className="mt-4">
        <ChoiceList
          choices={exam.currentQuestion.choices}
          selectedIds={exam.currentSelectedIds}
          onToggle={handleToggleChoice}
          disabled={false}
        />
      </div>

      {/* Flag + Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <FlagButton isFlagged={currentIsFlagged} onToggle={handleToggleFlag} />

        <div className="flex gap-2">
          <button
            type="button"
            disabled={exam.currentIndex === 0}
            onClick={exam.prevQuestion}
            aria-label="Question pr&eacute;c&eacute;dente"
            className="min-h-[44px] rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:text-neutral-400"
          >
            &larr; Pr&eacute;c&eacute;dente
          </button>
          {exam.currentIndex >= exam.questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setShowConfirmDialog(true)}
              aria-label="Terminer et soumettre l'examen"
              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Terminer l&apos;examen
            </button>
          ) : (
            <button
              type="button"
              onClick={exam.nextQuestion}
              aria-label="Question suivante"
              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Suivante &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Navigator grid + submit */}
      <div className="mt-4">
        <ExamNavigator
          totalQuestions={exam.questions.length}
          currentIndex={exam.currentIndex}
          answeredIndices={answeredIndices}
          flaggedIndices={flaggedIndices}
          onGoTo={exam.goToQuestion}
        />
        {exam.currentIndex < exam.questions.length - 1 && (
          <button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            className="mt-3 min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            Terminer l&apos;examen
          </button>
        )}
      </div>

      {/* Confirmation dialog with focus trap + ESC */}
      {showConfirmDialog && (
        <ConfirmDialog
          unansweredCount={exam.unansweredCount}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmSubmit}
        />
      )}
    </div>
  );
}

// --- Confirm dialog with focus trap + ESC ---

function ConfirmDialog({
  unansweredCount,
  onCancel,
  onConfirm,
}: {
  unansweredCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel button on mount
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // ESC to close + Tab focus trap
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmer la soumission de l'examen"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-bold text-neutral-900">
          Terminer l&apos;examen ?
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          {unansweredCount > 0
            ? `Vous avez ${unansweredCount} question${unansweredCount > 1 ? 's' : ''} sans réponse. Elles seront comptées comme incorrectes.`
            : 'Toutes les questions ont une réponse. Vous ne pourrez plus modifier vos réponses.'}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Continuer
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}
