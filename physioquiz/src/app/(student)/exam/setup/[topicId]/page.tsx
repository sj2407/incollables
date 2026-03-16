'use client';

import { createClient } from '@/lib/supabase/client';
import {
  buildTopicTree,
  fetchTopicsWithCounts,
  getTotalQuestionCount,
  type TopicWithCount,
} from '@/hooks/useTopics';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// --- Admin-controlled constants ---
const QUESTION_RATIO = 0.7; // 70% of available questions
const SECONDS_PER_QUESTION = 45;

interface ExamSetupPageProps {
  params: { topicId: string };
}

export default function ExamSetupPage({ params }: ExamSetupPageProps) {
  const { topicId } = params;
  const router = useRouter();

  const [topic, setTopic] = useState<TopicWithCount | null>(null);
  const [includeSubtopics, setIncludeSubtopics] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const result = await fetchTopicsWithCounts(supabase);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const tree = buildTopicTree(result.data);
    const found = findTopicById(tree, topicId);
    if (!found) {
      setError('Cours introuvable.');
      setLoading(false);
      return;
    }

    setTopic(found);
    if (found.questionCount === 0 && found.children.length > 0) {
      setIncludeSubtopics(true);
    }
    setLoading(false);
  }, [topicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const directCount = topic?.questionCount ?? 0;
  const totalCount = topic ? getTotalQuestionCount(topic) : 0;
  const hasSubtopics = topic ? topic.children.length > 0 : false;
  const availableCount = includeSubtopics ? totalCount : directCount;

  // Auto-computed: 70% of available questions, minimum 1
  const questionCount = Math.max(1, Math.ceil(availableCount * QUESTION_RATIO));
  // Auto-computed: 45s per question
  const timeLimitSeconds = questionCount * SECONDS_PER_QUESTION;
  const durationMin = Math.ceil(timeLimitSeconds / 60);

  const canStart = questionCount > 0 && availableCount > 0 && !starting;

  async function startExam() {
    if (!canStart) return;
    setStarting(true);
    setError(null);

    const supabase = createClient();

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    if (!authSession?.access_token) {
      setError('Vous devez être connecté.');
      setStarting(false);
      return;
    }

    const { data, error: fnError } = await supabase.functions.invoke(
      'select-questions',
      {
        body: {
          topic_id: topicId,
          session_type: 'exam',
          question_count: questionCount,
          include_subtopics: includeSubtopics,
          time_limit_seconds: timeLimitSeconds,
        },
      },
    );

    if (fnError || !data?.session_id) {
      setError(
        (data as Record<string, string> | null)?.error ??
          'Impossible de démarrer l\u2019examen. Réessayez.',
      );
      setStarting(false);
      return;
    }

    router.push(`/exam/play/${data.session_id}`);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="mt-6 h-64 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="mx-auto max-w-lg">
        <p role="alert" className="text-sm text-error">
          {error ?? 'Cours introuvable.'}
        </p>
        <button
          type="button"
          onClick={fetchData}
          className="mt-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
        Examen blanc
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {topic.title}
      </p>

      {/* Setup card */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
        {/* Subtopics toggle */}
        {hasSubtopics && (
          <label className="mb-6 flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={includeSubtopics}
              onChange={(e) => setIncludeSubtopics(e.target.checked)}
              className="h-5 w-5 rounded-md border-neutral-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-neutral-700">
              Inclure les sous-chapitres
            </span>
            {includeSubtopics && directCount !== totalCount && (
              <span className="text-xs text-neutral-400">
                ({totalCount} questions au total)
              </span>
            )}
          </label>
        )}

        {/* Exam info summary */}
        <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Questions</span>
            <span className="text-sm font-semibold text-neutral-900">
              {questionCount} / {availableCount}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-neutral-500">Durée</span>
            <span className="text-sm font-semibold text-neutral-900">
              {durationMin} min
            </span>
          </div>
        </div>

        {/* Start button */}
        <button
          type="button"
          disabled={!canStart}
          onClick={startExam}
          className="min-h-[44px] w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {starting ? 'Préparation...' : 'Démarrer l\u2019examen'}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-error">
            {error}
          </p>
        )}
      </div>

      {/* Back to training setup */}
      <button
        type="button"
        onClick={() => router.push(`/quiz/setup/${topicId}`)}
        className="mt-3 min-h-[44px] text-sm font-medium text-primary hover:text-primary-700"
      >
        &larr; Mode entraînement
      </button>
    </div>
  );
}

function findTopicById(
  tree: TopicWithCount[],
  id: string,
): TopicWithCount | null {
  for (const topic of tree) {
    if (topic.id === id) return topic;
    const found = findTopicById(topic.children, id);
    if (found) return found;
  }
  return null;
}
