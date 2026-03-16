'use client';

import { createClient } from '@/lib/supabase/client';
import {
  buildTopicTree,
  fetchTopicsWithCounts,
  getTotalQuestionCount,
  type TopicWithCount,
} from '@/hooks/useTopics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type QuestionCountOption = 10 | 25 | 'all';

interface QuizSetupPageProps {
  params: { topicId: string };
}

export default function QuizSetupPage({ params }: QuizSetupPageProps) {
  const { topicId } = params;
  const router = useRouter();

  const [topic, setTopic] = useState<TopicWithCount | null>(null);
  const [includeSubtopics, setIncludeSubtopics] = useState(false);
  const [selectedCount, setSelectedCount] = useState<QuestionCountOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Reuse shared fetch + tree building
    const result = await fetchTopicsWithCounts(supabase);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const tree = buildTopicTree(result.data);

    // Find our topic in the tree (search recursively)
    const found = findTopicById(tree, topicId);
    if (!found) {
      setError('Cours introuvable.');
      setLoading(false);
      return;
    }

    setTopic(found);
    // Auto-enable subtopics if topic has no direct questions but children do
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

  async function startSession() {
    if (starting || availableCount === 0 || selectedCount === null) return;
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

    const body = {
      topic_id: topicId,
      session_type: selectedCount === 'all' ? 'all' : 'short',
      question_count:
        selectedCount === 'all'
          ? availableCount
          : Math.min(selectedCount, availableCount),
      include_subtopics: includeSubtopics,
    };

    const { data, error: fnError } = await supabase.functions.invoke(
      'select-questions',
      { body },
    );

    if (fnError || !data?.session_id) {
      setError(
        (data as Record<string, string> | null)?.error ??
          'Impossible de démarrer la session. Réessayez.',
      );
      setStarting(false);
      return;
    }

    router.push(`/quiz/play/${data.session_id}`);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="mt-6 h-72 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
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
          className="mt-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary-500 hover:bg-primary-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
        {topic.title}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {availableCount} question{availableCount !== 1 ? 's' : ''} disponible
        {availableCount !== 1 ? 's' : ''}
      </p>

      {/* Setup card */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
        {/* Subtopics toggle */}
        {hasSubtopics && (
          <label className="mb-6 flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={includeSubtopics}
              onChange={(e) => {
                setIncludeSubtopics(e.target.checked);
                setSelectedCount(null);
              }}
              className="h-5 w-5 rounded-md border-neutral-300 text-primary-500 focus:ring-primary-500"
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

        {/* Question count selection */}
        <p className="mb-3 text-sm font-semibold text-neutral-700">
          Nombre de questions
        </p>
        <div className="flex flex-wrap gap-3">
          <CountOption
            label="10"
            selected={selectedCount === 10}
            available={availableCount >= 10}
            onSelect={() => setSelectedCount(selectedCount === 10 ? null : 10)}
          />
          <CountOption
            label="25"
            selected={selectedCount === 25}
            available={availableCount >= 25}
            onSelect={() => setSelectedCount(selectedCount === 25 ? null : 25)}
          />
          <CountOption
            label={`Toutes (${availableCount})`}
            selected={selectedCount === 'all'}
            available={availableCount >= 1}
            onSelect={() =>
              setSelectedCount(selectedCount === 'all' ? null : 'all')
            }
          />
        </div>

        {/* Start button */}
        <button
          type="button"
          disabled={selectedCount === null || availableCount === 0 || starting}
          onClick={startSession}
          className="mt-6 min-h-[44px] w-full rounded-lg bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {starting ? 'Préparation...' : 'Démarrer la session'}
        </button>

        {availableCount === 0 && (
          <p role="alert" className="mt-4 text-sm text-warning">
            Aucune question disponible pour ce chapitre.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-error">
            {error}
          </p>
        )}
      </div>

      {/* Exam mode link */}
      <Link
        href={`/exam/setup/${topic.id}`}
        className="mt-4 flex min-h-[44px] items-center justify-center rounded-lg border border-primary-200 bg-white px-5 py-3 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-50"
      >
        Mode examen blanc &rarr;
      </Link>

      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push('/practice')}
        className="mt-3 min-h-[44px] text-sm font-medium text-primary-500 hover:text-primary-600"
      >
        &larr; Retour aux cours
      </button>
    </div>
  );
}

function CountOption({
  label,
  selected,
  available,
  onSelect,
}: {
  label: string;
  selected: boolean;
  available: boolean;
  onSelect: () => void;
}) {
  if (!available) {
    return (
      <button
        type="button"
        disabled
        className="min-h-[44px] rounded-lg border border-neutral-200 bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-400"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-h-[44px] rounded-lg border-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
        selected
          ? 'border-primary-500 bg-primary-50 text-primary-600'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-200 hover:bg-primary-50'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Recursively find a topic by ID in a nested tree.
 */
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
