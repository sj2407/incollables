'use client';

import ChoiceList from '@/components/quiz/ChoiceList';
import CorrectionView from '@/components/quiz/CorrectionView';
import QuestionCard from '@/components/quiz/QuestionCard';
import ConfidenceSelector from '@/components/ui/ConfidenceSelector';
import { useQuiz } from '@/hooks/useQuiz';
import { useTimer } from '@/hooks/useTimer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

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

  // Loading state
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
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-md sm:p-8">
          <p className="text-lg font-bold text-neutral-900">Session expirée</p>
          <p className="mt-2 text-sm text-neutral-500">
            Cette session est en pause depuis plus de 7 jours.
          </p>
          <button
            type="button"
            onClick={() => router.push('/practice')}
            className="mt-4 min-h-[44px] rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
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

  // Session already complete (e.g. navigated back to a finished session)
  if (quiz.isSessionComplete && !quiz.currentQuestion) {
    router.replace(`/quiz/results/${sessionId}`);
    return null;
  }

  // Session just completed on last answer
  if (quiz.isSessionComplete && quiz.isValidated) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-md sm:p-8">
          <h2 className="text-lg font-bold text-neutral-900">
            Session terminée !
          </h2>
          {quiz.correction?.session_stats && (
            <div className="mt-4">
              <p className="text-3xl font-bold text-primary">
                {quiz.correction.session_stats.average_score != null
                  ? `${quiz.correction.session_stats.average_score}%`
                  : `${quiz.correction.session_stats.score_percent}%`}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Score moyen sur{' '}
                {quiz.correction.session_stats.question_count} questions
              </p>
              <div className="mt-3 flex justify-center gap-4 text-sm">
                <span className="text-secondary-500">
                  {quiz.correction.session_stats.correct_count} correcte
                  {quiz.correction.session_stats.correct_count !== 1 ? 's' : ''}
                </span>
                <span className="text-warning">
                  {quiz.correction.session_stats.partial_count} partielle
                  {quiz.correction.session_stats.partial_count !== 1 ? 's' : ''}
                </span>
                <span className="text-error">
                  {quiz.correction.session_stats.wrong_count} incorrecte
                  {quiz.correction.session_stats.wrong_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => router.push(`/quiz/results/${sessionId}`)}
            className="mt-6 min-h-[44px] rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Voir les résultats détaillés
          </button>
        </div>
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
    <div className="mx-auto max-w-2xl" ref={quiz.questionRef} tabIndex={-1}>
      {/* Back link */}
      <Link
        href="/practice"
        className="mb-3 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        ← Retour
      </Link>

      {/* Question card with progress */}
      <QuestionCard
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
      <div className="mt-4">
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
        />
      </div>

      {/* Confidence selector */}
      <div className="mt-4">
        <ConfidenceSelector
          value={quiz.confidence}
          onChange={quiz.setConfidence}
          disabled={quiz.isValidated}
        />
      </div>

      {/* Validate button */}
      {!quiz.isValidated && (
        <button
          type="button"
          onClick={quiz.validateAnswer}
          disabled={quiz.isValidating || !hasSelections}
          className="mt-6 min-h-[44px] w-full rounded-xl bg-primary px-5 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
        >
          {quiz.isValidating ? 'Validation...' : 'Valider ma réponse'}
        </button>
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
            selectedCount={quiz.selectedChoiceIds.size}
          />

          {/* Next question button */}
          {!quiz.isSessionComplete && (
            <button
              type="button"
              onClick={quiz.nextQuestion}
              className="mt-4 min-h-[44px] w-full rounded-xl bg-primary px-5 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              Question suivante
            </button>
          )}
        </>
      )}
    </div>
  );
}
