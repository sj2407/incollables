'use client';

import { createClient } from '@/lib/supabase/client';
import {
  buildTopicTree,
  fetchTopicsWithCounts,
  getTotalQuestionCount,
  type TopicWithCount,
} from '@/hooks/useTopics';
import { Timer, CaretRight, ArrowLeft } from '@phosphor-icons/react';
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
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
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
          className="mt-2 min-h-[44px] rounded-2xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
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
      <div className="mt-5 space-y-4">
        {/* Subtopics toggle */}
        {hasSubtopics && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 glass-card-inner p-3">
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
          <p className="mb-2 text-sm font-semibold text-neutral-700">
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
          className="flex min-h-[44px] items-center justify-between glass-card-inner p-3 transition-colors hover:bg-white/80"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Timer size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Mode examen blanc</p>
              <p className="text-xs text-neutral-500">Chronomètre et sans corrections immédiates</p>
            </div>
          </div>
          <CaretRight size={16} className="text-neutral-400" />
        </Link>

        {/* Start button */}
        <button
          type="button"
          disabled={selectedCount === null || availableCount === 0 || starting}
          onClick={startSession}
          className={`min-h-[44px] w-full rounded-2xl bg-primary glass-btn px-5 py-3 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none${selectedCount !== null && availableCount > 0 && !starting ? ' animate-glow-pulse' : ''}`}
          style={{ transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
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
        className="mt-3 min-h-[44px] text-sm font-medium text-primary hover:text-primary-700"
      >
        <ArrowLeft size={14} className="mr-1 inline" />Retour aux cours
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
        className="flex min-h-[44px] flex-col items-center justify-center glass-card-inner opacity-50 p-3 text-neutral-400"
      >
        <span className="text-lg font-bold">{label}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{sublabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border-2 p-3 transition-all ${
        selected
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary/50'
      }`}
    >
      <span className="text-lg font-bold">{label}</span>
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
