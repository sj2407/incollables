'use client';

import { isAbandoned } from '@/lib/pause-manager';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface PausedSession {
  id: string;
  topic_title: string;
  question_count: number;
  answered_count: number;
  paused_at: string;
  is_abandoned: boolean;
}

interface CompletedSession {
  id: string;
  topic_title: string;
  score_percent: number | null;
  completed_at: string;
  question_count: number;
}

interface WeakQuestion {
  question_id: string;
  question_text: string;
  question_number: number | null;
  topic_title: string;
  avg_score: number;
  attempt_count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [paused, setPaused] = useState<PausedSession[]>([]);
  const [completed, setCompleted] = useState<CompletedSession[]>([]);
  const [weakQuestions, setWeakQuestions] = useState<WeakQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Non connecté.');
      setLoading(false);
      return;
    }

    // Fetch paused sessions, recent completed, and weak questions in parallel
    const [pausedResult, completedResult, weakResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, topic_id, question_count, correct_count, wrong_count, partial_count, paused_at, is_paused, topics(title)')
        .eq('user_id', user.id)
        .eq('is_paused', true)
        .eq('is_completed', false)
        .order('paused_at', { ascending: false }),
      supabase
        .from('sessions')
        .select('id, topic_id, question_count, score_percent, completed_at, topics(title)')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(5),
      supabase.rpc('get_weak_questions', { p_user_id: user.id }),
    ]);

    if (pausedResult.error || completedResult.error) {
      setError('Impossible de charger le tableau de bord.');
      setLoading(false);
      return;
    }

    const pausedSessions: PausedSession[] = (pausedResult.data ?? []).map((s) => {
      const answeredCount = (s.correct_count ?? 0) + (s.wrong_count ?? 0) + (s.partial_count ?? 0);
      const topicData = (Array.isArray(s.topics) ? s.topics[0] : s.topics) as { title: string } | null;
      return {
        id: s.id,
        topic_title: topicData?.title ?? 'Sans cours',
        question_count: s.question_count,
        answered_count: answeredCount,
        paused_at: s.paused_at ?? '',
        is_abandoned: isAbandoned(s.paused_at),
      };
    });

    const completedSessions: CompletedSession[] = (completedResult.data ?? []).map((s) => {
      const topicData = (Array.isArray(s.topics) ? s.topics[0] : s.topics) as { title: string } | null;
      return {
        id: s.id,
        topic_title: topicData?.title ?? 'Sans cours',
        score_percent: s.score_percent,
        completed_at: s.completed_at ?? '',
        question_count: s.question_count,
      };
    });

    const weak: WeakQuestion[] = (weakResult.data ?? []).map((q: WeakQuestion) => ({
      question_id: q.question_id,
      question_text: q.question_text,
      question_number: q.question_number,
      topic_title: q.topic_title,
      avg_score: Number(q.avg_score),
      attempt_count: Number(q.attempt_count),
    }));

    setPaused(pausedSessions);
    setCompleted(completedSessions);
    setWeakQuestions(weak);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
          Tableau de bord
        </h1>
        <div className="mt-6 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
          Tableau de bord
        </h1>
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
        <button
          type="button"
          onClick={fetchDashboard}
          className="mt-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary-500 hover:bg-primary-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
        Tableau de bord
      </h1>

      {/* Paused sessions */}
      <section className="mt-6" aria-labelledby="paused-heading">
        <h2 id="paused-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
          Sessions en cours
        </h2>
        {paused.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Aucune session en cours.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {paused.map((session) => (
              <PausedSessionCard
                key={session.id}
                session={session}
                onResume={() => router.push(`/quiz/play/${session.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent completed sessions */}
      <section className="mt-8" aria-labelledby="completed-heading">
        <h2 id="completed-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
          Sessions récentes
        </h2>
        {completed.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Aucune session terminée.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {completed.map((session) => (
              <CompletedSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>

      {/* Weak questions */}
      {weakQuestions.length > 0 && (
        <WeakQuestionsSection questions={weakQuestions} />
      )}

      {/* Quick-start */}
      <div className="mt-8">
        <Link
          href="/topics"
          className="flex min-h-[44px] items-center justify-center rounded-lg bg-primary-500 px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-600 active:scale-[0.97]"
        >
          Commencer une session
        </Link>
      </div>
    </div>
  );
}

function PausedSessionCard({
  session,
  onResume,
}: {
  session: PausedSession;
  onResume: () => void;
}) {
  const [resuming, setResuming] = useState(false);
  const progressPercent =
    session.question_count > 0
      ? Math.round((session.answered_count / session.question_count) * 100)
      : 0;

  const handleResume = () => {
    setResuming(true);
    onResume();
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {session.topic_title}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {session.answered_count}/{session.question_count} ({progressPercent}%)
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            En pause depuis {formatPauseDuration(session.paused_at)}
          </p>
        </div>
        <div className="shrink-0">
          {session.is_abandoned ? (
            <span className="text-xs font-medium text-error" role="status">
              Session expirée
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResume}
              disabled={resuming}
              aria-label={`Reprendre la session ${session.topic_title}`}
              className="min-h-[44px] rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 active:scale-[0.97] disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {resuming ? 'Reprise...' : <><span aria-hidden="true">▶ </span>Reprendre</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CompletedSessionCard({ session }: { session: CompletedSession }) {
  const scoreColor =
    (session.score_percent ?? 0) >= 75
      ? 'text-secondary-500'
      : (session.score_percent ?? 0) >= 40
        ? 'text-warning'
        : 'text-error';

  return (
    <Link
      href={`/quiz/results/${session.id}`}
      className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-md transition-colors hover:bg-neutral-50 sm:p-4"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-700">
          {session.topic_title}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {session.question_count} questions · {formatDateTime(session.completed_at)}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-bold ${scoreColor}`}>
        {session.score_percent ?? 0}%
      </span>
    </Link>
  );
}

function formatPauseDuration(pausedAt: string): string {
  if (!pausedAt) return '';
  const diffMs = Date.now() - new Date(pausedAt).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "moins d'1min";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

function WeakQuestionsSection({ questions }: { questions: WeakQuestion[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? questions : questions.slice(0, 3);
  const hasMore = questions.length > 3;

  return (
    <section className="mt-8" aria-labelledby="weak-heading">
      <h2 id="weak-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
        Questions à revoir ({questions.length})
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Classées par difficulté (score × tentatives)
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {visible.map((q) => (
          <WeakQuestionCard key={q.question_id} question={q} />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 min-h-[44px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-50"
        >
          {expanded ? 'Voir moins' : `Voir les ${questions.length - 3} autres`}
        </button>
      )}
    </section>
  );
}

function WeakQuestionCard({ question }: { question: WeakQuestion }) {
  const scoreColor =
    question.avg_score >= 40
      ? 'text-warning'
      : 'text-error';

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-md sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-700">
            {question.question_number ? `Q${question.question_number}. ` : ''}
            {question.question_text}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {question.topic_title} · {question.attempt_count} session{question.attempt_count > 1 ? 's' : ''}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-bold ${scoreColor}`}>
          {question.avg_score}%
        </span>
      </div>
    </div>
  );
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
