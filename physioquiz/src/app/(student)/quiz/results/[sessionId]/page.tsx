'use client';

import SessionSummary from '@/components/quiz/SessionSummary';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface ResultsData {
  sessionId: string;
  topicId: string;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  partialCount: number;
  scorePercent: number;
  durationSeconds: number | null;
  answers: {
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
  }[];
}

interface QuizResultsPageProps {
  params: { sessionId: string };
}

export default function QuizResultsPage({ params }: QuizResultsPageProps) {
  const { sessionId } = params;
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Fetch session
    const { data: session, error: sError } = await supabase
      .from('sessions')
      .select(
        'id, topic_id, question_count, correct_count, wrong_count, partial_count, score_percent, duration_seconds, total_pause_seconds, is_completed',
      )
      .eq('id', sessionId)
      .single();

    if (sError || !session) {
      setError('Session introuvable.');
      setLoading(false);
      return;
    }

    if (!session.is_completed) {
      setError('Cette session n\u2019est pas encore terminée.');
      setLoading(false);
      return;
    }

    // Fetch session answers
    const { data: sessionAnswers, error: saError } = await supabase
      .from('session_answers')
      .select('id, question_id, is_correct, is_partially_correct, score_percent')
      .eq('session_id', sessionId);

    if (saError || !sessionAnswers) {
      setError('Impossible de charger les réponses.');
      setLoading(false);
      return;
    }

    const questionIds = sessionAnswers.map((sa) => sa.question_id);
    const answerIds = sessionAnswers.map((sa) => sa.id);

    // Parallelize independent queries
    const [questionsResult, choicesResult, answerChoicesResult] =
      await Promise.all([
        supabase
          .from('published_questions')
          .select('id, question_text, question_number, explanation_html')
          .in('id', questionIds),
        supabase.rpc('get_session_choices', { p_session_id: sessionId }),
        supabase
          .from('session_answer_choices')
          .select('session_answer_id, choice_id')
          .in('session_answer_id', answerIds),
      ]);

    const questions = questionsResult.data;
    const allChoices = choicesResult.data;
    const answerChoices = answerChoicesResult.data;

    if (choicesResult.error) {
      setError('Impossible de charger les corrections.');
      setLoading(false);
      return;
    }

    const choicesMap: Record<
      string,
      { id: string; label: string; choice_text: string; is_correct: boolean }[]
    > = {};

    for (const c of allChoices ?? []) {
      const qId = c.question_id as string;
      if (!choicesMap[qId]) choicesMap[qId] = [];
      choicesMap[qId].push({
        id: c.choice_id as string,
        label: c.label,
        choice_text: c.choice_text,
        is_correct: c.is_correct,
      });
    }

    const selectedByAnswer: Record<string, string[]> = {};
    for (const ac of answerChoices ?? []) {
      if (!selectedByAnswer[ac.session_answer_id]) {
        selectedByAnswer[ac.session_answer_id] = [];
      }
      selectedByAnswer[ac.session_answer_id].push(ac.choice_id);
    }

    const questionMap = new Map(
      (questions ?? []).map((q) => [q.id, q]),
    );

    // Build answer details, sorted by question number
    const answers = sessionAnswers
      .sort((a, b) => {
        const qA = questionMap.get(a.question_id);
        const qB = questionMap.get(b.question_id);
        return (qA?.question_number ?? 0) - (qB?.question_number ?? 0);
      })
      .map((sa) => {
      const q = questionMap.get(sa.question_id);
      const choices = choicesMap[sa.question_id] ?? [];
      const correctIds = choices
        .filter((c) => c.is_correct)
        .map((c) => c.id);

      return {
        question_id: sa.question_id,
        question_text: q?.question_text ?? '',
        question_number: q?.question_number ?? null,
        is_correct: sa.is_correct,
        is_partially_correct: sa.is_partially_correct,
        score_percent: sa.score_percent,
        correct_choice_ids: correctIds,
        selected_choice_ids: selectedByAnswer[sa.id] ?? [],
        choices,
        explanation_html: q?.explanation_html ?? null,
      };
    });

    setData({
      sessionId: session.id,
      topicId: session.topic_id,
      questionCount: session.question_count,
      correctCount: session.correct_count,
      wrongCount: session.wrong_count,
      partialCount: session.partial_count,
      scorePercent: session.score_percent ?? 0,
      durationSeconds:
        session.duration_seconds != null
          ? Math.max(0, session.duration_seconds - (session.total_pause_seconds ?? 0))
          : null,
      answers,
    });
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-64 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl">
        <p role="alert" className="text-sm text-error">
          {error ?? 'Erreur inconnue.'}
        </p>
        <button
          type="button"
          onClick={fetchResults}
          className="mt-2 min-h-[44px] rounded-2xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/practice"
          className="mb-3 inline-flex min-h-[44px] items-center gap-1 rounded-2xl px-2 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          ← Retour
        </Link>
      </div>
      <SessionSummary
        topicId={data.topicId}
        questionCount={data.questionCount}
        correctCount={data.correctCount}
        wrongCount={data.wrongCount}
        partialCount={data.partialCount}
        scorePercent={data.scorePercent}
        durationSeconds={data.durationSeconds}
        answers={data.answers}
      />
    </>
  );
}
