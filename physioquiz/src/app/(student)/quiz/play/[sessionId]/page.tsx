'use client';

import ChoiceList from '@/components/quiz/ChoiceList';
import CorrectionView from '@/components/quiz/CorrectionView';
import QuestionCard from '@/components/quiz/QuestionCard';
import ConfidenceSelector from '@/components/ui/ConfidenceSelector';
import ResultsBottomSheet from '@/components/quiz/ResultsBottomSheet';
import { motion } from 'motion/react';
import { useQuiz } from '@/hooks/useQuiz';
import { useSwipe } from '@/hooks/useSwipe';
import { useTimer } from '@/hooks/useTimer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface QuizPlayPageProps {
  params: { sessionId: string };
}

export default function QuizPlayPage({ params }: QuizPlayPageProps) {
  const { sessionId } = params;
  const router = useRouter();
  const quiz = useQuiz(sessionId);
  const elapsedSeconds = useTimer({
    running: quiz.timerRunning,
    baseElapsed: quiz.timerBaseElapsed,
  });

  const handlePause = quiz.handlePause;
  const onPause = useCallback(async () => {
    const result = await handlePause();
    if (!result.error) {
      router.push('/practice');
    }
  }, [handlePause, router]);

  // Redirect if session is already complete (e.g. navigated back to a finished session)
  const shouldRedirectToResults = !quiz.isLoading && quiz.isSessionComplete && !quiz.currentQuestion;
  useEffect(() => {
    if (shouldRedirectToResults) {
      router.replace(`/quiz/results/${sessionId}`);
    }
  }, [shouldRedirectToResults, router, sessionId]);

  const [showResults, setShowResults] = useState(false);

  const swipe = useSwipe({
    onSwipeLeft: quiz.isValidated && !quiz.isSessionComplete ? quiz.nextQuestion : undefined,
  });

  // Loading state (checked after hooks but redirect waits for loading to finish)
  if (quiz.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-48 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
        <div className="mt-4 flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100"
            />
          ))}
        </div>
      </div>
    );
  }

  // Abandoned session
  if (quiz.isAbandoned) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="glass-card p-6 sm:p-8">
          <p className="text-lg font-bold text-neutral-900">Session expirée</p>
          <p className="mt-2 text-sm text-neutral-500">
            Cette session est en pause depuis plus de 7 jours.
          </p>
          <button
            type="button"
            onClick={() => router.push('/practice')}
            className="mt-4 min-h-[44px] rounded-2xl bg-primary glass-btn px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Commencer une nouvelle session
          </button>
        </div>
      </div>
    );
  }

  // Error state (no question available)
  if (quiz.error && !quiz.currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl">
        <p role="alert" className="text-sm text-error">
          {quiz.error}
        </p>
      </div>
    );
  }

  if (shouldRedirectToResults) {
    return null;
  }

  // Session just completed on last answer
  if (quiz.isSessionComplete && quiz.isValidated) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          href="/practice"
          className="mb-2 inline-flex min-h-[44px] items-center gap-1 rounded-2xl px-2 py-1 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          ← Retour
        </Link>

        {/* Static background — always visible */}
        <div className="glass-card p-4 text-center sm:p-5">
          <h2 className="text-base font-bold text-neutral-900">
            Session terminée !
          </h2>
          {quiz.correction?.session_stats && (
            <div className="mt-3">
              <p className="text-2xl font-bold text-primary">
                {quiz.correction.session_stats.average_score != null
                  ? `${quiz.correction.session_stats.average_score}%`
                  : `${quiz.correction.session_stats.score_percent}%`}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Score moyen sur {quiz.correction.session_stats.question_count} questions
              </p>
            </div>
          )}
        </div>

        {/* Peek handle — fixed above nav bar */}
        {!showResults && (
          <motion.button
            type="button"
            onClick={() => setShowResults(true)}
            className="fixed inset-x-0 bottom-16 z-30 mx-auto w-[calc(100%-2rem)] max-w-2xl rounded-t-2xl bg-white/70 backdrop-blur-xl border border-white/60 px-4 pb-3 pt-2.5 text-center shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-neutral-300" />
            <p className="text-sm font-semibold text-primary">Voir les résultats détaillés</p>
          </motion.button>
        )}

        {/* Full-screen results overlay — slides up from bottom */}
        {showResults && (
          <motion.div
            className="fixed inset-x-0 bottom-0 top-0 z-40 overflow-y-auto bg-page-gradient"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto max-w-2xl px-4 pb-24 pt-16">
              <Link
                href="/practice"
                className="mb-2 inline-flex min-h-[44px] items-center gap-1 rounded-2xl px-2 py-1 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                ← Retour
              </Link>
              <ResultsBottomSheet sessionId={sessionId} />
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // No current question (shouldn't happen)
  if (!quiz.currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-neutral-500">Aucune question à afficher.</p>
      </div>
    );
  }

  const hasSelections = quiz.selectedChoiceIds.size > 0;

  return (
    <div
      className="mx-auto max-w-2xl"
      ref={quiz.questionRef}
      tabIndex={-1}
      style={{ touchAction: 'pan-y' }}
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
    >
      {/* Back link */}
      <Link
        href="/practice"
        className="mb-2 inline-flex min-h-[44px] items-center gap-1 rounded-2xl px-2 py-1 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        ← Retour
      </Link>

      {/* Question card with progress */}
      <QuestionCard
        key={quiz.currentIndex}
        question={quiz.currentQuestion}
        currentIndex={quiz.currentIndex}
        totalQuestions={quiz.questions.length}
        elapsedSeconds={elapsedSeconds}
        progress={quiz.progress}
        showTimer={quiz.sessionType === 'exam'}
        canPause={quiz.canPause}
        isPausing={quiz.isPausing}
        onPause={onPause}
      />

      {/* Choices */}
      <div className="mt-3">
        <ChoiceList
          choices={quiz.currentQuestion.choices}
          selectedIds={quiz.selectedChoiceIds}
          onToggle={quiz.toggleChoice}
          disabled={quiz.isValidated}
          correctChoiceIds={
            quiz.isValidated
              ? quiz.correction?.correct_choice_ids
              : undefined
          }
          crossedOutIds={quiz.crossedOutIds}
          onToggleCrossOut={quiz.toggleCrossOut}
        />
      </div>

      {/* Confidence selector */}
      <div className="mt-3">
        <ConfidenceSelector
          value={quiz.confidence}
          onChange={quiz.setConfidence}
          disabled={quiz.isValidated}
        />
      </div>

      {/* Validate button */}
      {!quiz.isValidated && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={quiz.validateAnswer}
            disabled={quiz.isValidating || !hasSelections}
            className="min-h-[44px] rounded-2xl bg-primary glass-btn px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
            style={{ transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            {quiz.isValidating ? 'Validation...' : 'Valider'}
          </button>
        </div>
      )}

      {/* Error during validation */}
      {quiz.error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {quiz.error}
        </p>
      )}

      {/* Correction view (after validation) */}
      {quiz.isValidated && quiz.correction && (
        <>
          <CorrectionView
            correction={quiz.correction}
          />

          {/* Next question button */}
          {!quiz.isSessionComplete && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={quiz.nextQuestion}
                className="min-h-[44px] rounded-2xl bg-primary glass-btn px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
                style={{ transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                Suivante →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
