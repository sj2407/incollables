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
        {topic.title}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {availableCount} question{availableCount !== 1 ? 's' : ''} disponible
        {availableCount !== 1 ? 's' : ''}
      </p>

      {/* Setup card */}
      <div className="mt-6 space-y-6">
        {/* Subtopics toggle */}
        {hasSubtopics && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <input
              type="checkbox"
              checked={includeSubtopics}
              onChange={(e) => {
                setIncludeSubtopics(e.target.checked);
                setSelectedCount(null);
              }}
              className="h-5 w-5 rounded-md border-neutral-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-semibold text-neutral-700">
                Inclure les sous-chapitres
              </span>
              {includeSubtopics && directCount !== totalCount && (
                <p className="text-xs text-neutral-400">
                  {totalCount} questions au total
                </p>
              )}
            </div>
          </label>
        )}

        {/* Question count selection */}
        <div>
          <p className="mb-3 text-sm font-semibold text-neutral-700">
            Nombre de questions
          </p>
          <div className="grid grid-cols-3 gap-3">
            <CountOption
              label="10"
              sublabel="Rapide"
              selected={selectedCount === 10}
              available={availableCount >= 10}
              onSelect={() => setSelectedCount(selectedCount === 10 ? null : 10)}
            />
            <CountOption
              label="25"
              sublabel="Standard"
              selected={selectedCount === 25}
              available={availableCount >= 25}
              onSelect={() => setSelectedCount(selectedCount === 25 ? null : 25)}
            />
            <CountOption
              label={`${availableCount}`}
              sublabel="Toutes"
              selected={selectedCount === 'all'}
              available={availableCount >= 1}
              onSelect={() =>
                setSelectedCount(selectedCount === 'all' ? null : 'all')
              }
            />
          </div>
        </div>

        {/* Exam mode link */}
        <Link
          href={`/exam/setup/${topic.id}`}
          className="flex min-h-[44px] items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <span className="text-lg text-amber-600">⏱</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Mode examen blanc</p>
              <p className="text-xs text-neutral-500">Chronomètre et sans corrections immédiates</p>
            </div>
          </div>
          <span className="text-neutral-400">&rarr;</span>
        </Link>

        {/* Start button */}
        <button
          type="button"
          disabled={selectedCount === null || availableCount === 0 || starting}
          onClick={startSession}
          className="min-h-[44px] w-full rounded-xl bg-primary px-5 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
        >
          {starting ? 'Préparation...' : 'Démarrer la session'}
        </button>

        {availableCount === 0 && (
          <p role="alert" className="text-sm text-warning">
            Aucune question disponible pour ce chapitre.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>

      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push('/practice')}
        className="mt-4 min-h-[44px] text-sm font-medium text-primary hover:text-primary-700"
      >
        &larr; Retour aux cours
      </button>
    </div>
  );
}

function CountOption({
  label,
  sublabel,
  selected,
  available,
  onSelect,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  available: boolean;
  onSelect: () => void;
}) {
  if (!available) {
    return (
      <button
        type="button"
        disabled
        className="flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 p-4 text-neutral-400"
      >
        <span className="text-xl font-bold">{label}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{sublabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary/50'
      }`}
    >
      <span className="text-xl font-bold">{label}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{sublabel}</span>
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
