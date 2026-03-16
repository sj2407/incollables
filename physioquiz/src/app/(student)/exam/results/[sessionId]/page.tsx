'use client';

import { createClient } from '@/lib/supabase/client';
import ExamResultsView from '@/components/exam/ExamResults';
import type { ExamResults } from '@/hooks/useExam';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface ExamResultsPageProps {
  params: { sessionId: string };
}

export default function ExamResultsPage({ params }: ExamResultsPageProps) {
  const { sessionId } = params;
  const [results, setResults] = useState<ExamResults | null>(null);
  const [topicId, setTopicId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Fetch session metadata
    const { data: session } = await supabase
      .from('sessions')
      .select(
        'id, topic_id, session_type, is_completed, question_count, correct_count, wrong_count, partial_count, score_percent, duration_seconds, time_limit_seconds',
      )
      .eq('id', sessionId)
      .single();

    if (!session) {
      setError('Session introuvable.');
      setLoading(false);
      return;
    }

    if (session.session_type !== 'exam') {
      setError('Cette session n\u2019est pas un examen.');
      setLoading(false);
      return;
    }

    if (!session.is_completed) {
      setError('Cet examen n\u2019est pas encore termin\u00e9.');
      setLoading(false);
      return;
    }

    setTopicId(session.topic_id);

    // Fetch answers
    const { data: answers } = await supabase
      .from('session_answers')
      .select('id, question_id, is_correct, is_partially_correct, score_percent, is_flagged')
      .eq('session_id', sessionId);

    // Fetch session questions for ordering
    const { data: sessionQuestions } = await supabase
      .from('session_questions')
      .select('question_id, sort_order')
      .eq('session_id', sessionId)
      .order('sort_order');

    const questionIds = (sessionQuestions ?? []).map((sq) => sq.question_id);

    // Fetch question data
    const { data: questions } = await supabase
      .from('questions')
      .select('id, question_number, question_text, explanation_html')
      .in('id', questionIds);

    // Fetch choices (with is_correct — session is completed, OK to reveal)
    const { data: choicesResult } = await supabase
      .rpc('get_session_choices', { p_session_id: sessionId });

    // Build choices by question
    const choicesByQuestion: Record<string, { id: string; label: string; choice_text: string; is_correct: boolean; sort_order: number }[]> = {};
    for (const c of choicesResult ?? []) {
      if (!choicesByQuestion[c.question_id]) {
        choicesByQuestion[c.question_id] = [];
      }
      choicesByQuestion[c.question_id].push({
        id: c.choice_id ?? c.id,
        label: c.label,
        choice_text: c.choice_text,
        is_correct: c.is_correct,
        sort_order: c.sort_order,
      });
    }

    // Fetch answer choices
    const answerIds = (answers ?? []).map((a) => a.id);
    const { data: answerChoices } = await supabase
      .from('session_answer_choices')
      .select('session_answer_id, choice_id')
      .in('session_answer_id', answerIds.length > 0 ? answerIds : ['__none__']);

    const selectedByAnswer: Record<string, string[]> = {};
    for (const ac of answerChoices ?? []) {
      if (!selectedByAnswer[ac.session_answer_id]) {
        selectedByAnswer[ac.session_answer_id] = [];
      }
      selectedByAnswer[ac.session_answer_id].push(ac.choice_id);
    }

    // Build question results in order
    const answerByQuestion = new Map(
      (answers ?? []).map((a) => [a.question_id, a]),
    );
    const questionMap = new Map(
      (questions ?? []).map((q) => [q.id, q]),
    );

    let unansweredCount = 0;

    const resultsArray = questionIds.map((qId) => {
      const answer = answerByQuestion.get(qId);
      const qData = questionMap.get(qId);
      const choices = choicesByQuestion[qId] ?? [];
      const correctIds = choices.filter((c) => c.is_correct).map((c) => c.id);
      const selectedIds = answer ? (selectedByAnswer[answer.id] ?? []) : [];
      const isUnanswered = selectedIds.length === 0;
      if (isUnanswered) unansweredCount++;

      return {
        question_id: qId,
        question_number: qData?.question_number ?? null,
        question_text: qData?.question_text ?? '',
        explanation_html: qData?.explanation_html ?? null,
        selected_choice_ids: selectedIds,
        correct_choice_ids: correctIds,
        is_correct: answer?.is_correct ?? false,
        is_partially_correct: answer?.is_partially_correct ?? false,
        score_percent: answer?.score_percent ?? 0,
        is_flagged: answer?.is_flagged ?? false,
        is_unanswered: isUnanswered,
        choices,
      };
    });

    setResults({
      session_id: sessionId,
      score_percent: session.score_percent ?? 0,
      duration_seconds: session.duration_seconds ?? 0,
      time_limit_seconds: session.time_limit_seconds,
      correct_count: session.correct_count,
      wrong_count: session.wrong_count,
      partial_count: session.partial_count,
      unanswered_count: unansweredCount,
      question_count: session.question_count,
      results: resultsArray,
    });

    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="mt-6 h-64 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="mx-auto max-w-2xl">
        <p role="alert" className="text-sm text-error">
          {error ?? 'Erreur de chargement.'}
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

  return <ExamResultsView results={results} topicId={topicId} />;
}
