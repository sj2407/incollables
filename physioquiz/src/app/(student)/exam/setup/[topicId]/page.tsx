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

type QuestionCountOption = 20 | 40 | 60 | 'custom' | 'all';
type DurationOption = 30 | 60 | 120 | 'custom';

interface ExamSetupPageProps {
  params: { topicId: string };
}

export default function ExamSetupPage({ params }: ExamSetupPageProps) {
  const { topicId } = params;
  const router = useRouter();

  const [topic, setTopic] = useState<TopicWithCount | null>(null);
  const [includeSubtopics, setIncludeSubtopics] = useState(false);
  const [selectedCount, setSelectedCount] = useState<QuestionCountOption | null>(null);
  const [customCount, setCustomCount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [customDuration, setCustomDuration] = useState('');
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

  // Resolve actual question count
  let actualQuestionCount = 0;
  if (selectedCount === 'all') {
    actualQuestionCount = availableCount;
  } else if (selectedCount === 'custom') {
    const parsed = parseInt(customCount, 10);
    actualQuestionCount = isNaN(parsed) ? 0 : Math.min(parsed, availableCount);
  } else if (selectedCount !== null) {
    actualQuestionCount = Math.min(selectedCount, availableCount);
  }

  // Resolve actual duration in minutes
  let actualDurationMin = 0;
  if (selectedDuration === 'custom') {
    const parsed = parseInt(customDuration, 10);
    actualDurationMin = isNaN(parsed) ? 0 : parsed;
  } else if (selectedDuration !== null) {
    actualDurationMin = selectedDuration;
  }

  const canStart = actualQuestionCount > 0 && actualDurationMin > 0 && !starting;

  async function startExam() {
    if (!canStart) return;
    setStarting(true);
    setError(null);

    const supabase = createClient();

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    if (!authSession?.access_token) {
      setError('Vous devez \u00eatre connect\u00e9.');
      setStarting(false);
      return;
    }

    const { data, error: fnError } = await supabase.functions.invoke(
      'select-questions',
      {
        body: {
          topic_id: topicId,
          session_type: 'exam',
          question_count: actualQuestionCount,
          include_subtopics: includeSubtopics,
          time_limit_seconds: actualDurationMin * 60,
        },
      },
    );

    if (fnError || !data?.session_id) {
      setError(
        (data as Record<string, string> | null)?.error ??
          'Impossible de d\u00e9marrer l\u2019examen. R\u00e9essayez.',
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
        <div className="mt-6 h-96 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
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
          R&eacute;essayer
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
        {topic.title} &mdash; {availableCount} question{availableCount !== 1 ? 's' : ''} disponible
        {availableCount !== 1 ? 's' : ''}
      </p>

      {/* Setup card */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
        {/* Warning */}
        <div className="mb-6 rounded-lg border border-warning/30 bg-amber-50 p-3">
          <p className="text-sm font-medium text-warning">
            Correction &agrave; la fin uniquement. Pas de pause possible.
          </p>
        </div>

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

        {/* Question count */}
        <p className="mb-3 text-sm font-semibold text-neutral-700">
          Nombre de questions
        </p>
        <div className="mb-6 flex flex-wrap gap-3">
          {([20, 40, 60] as const).map((n) => (
            <OptionButton
              key={n}
              label={String(n)}
              selected={selectedCount === n}
              available={availableCount >= n}
              onSelect={() => setSelectedCount(selectedCount === n ? null : n)}
            />
          ))}
          <OptionButton
            label={`Toutes (${availableCount})`}
            selected={selectedCount === 'all'}
            available={availableCount >= 1}
            onSelect={() => setSelectedCount(selectedCount === 'all' ? null : 'all')}
          />
          <OptionButton
            label="Personnalisé"
            selected={selectedCount === 'custom'}
            available={availableCount >= 1}
            onSelect={() => setSelectedCount(selectedCount === 'custom' ? null : 'custom')}
          />
        </div>

        {selectedCount === 'custom' && (
          <input
            type="number"
            min={1}
            max={availableCount}
            value={customCount}
            onChange={(e) => setCustomCount(e.target.value)}
            placeholder={`1 \u2013 ${availableCount}`}
            aria-label="Nombre de questions personnalisé"
            className="mb-6 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoComplete="off"
          />
        )}

        {/* Duration */}
        <p className="mb-3 text-sm font-semibold text-neutral-700">
          Dur&eacute;e
        </p>
        <div className="mb-6 flex flex-wrap gap-3">
          {([30, 60, 120] as const).map((m) => (
            <OptionButton
              key={m}
              label={m < 60 ? `${m} min` : `${m / 60}h`}
              selected={selectedDuration === m}
              available={true}
              onSelect={() => setSelectedDuration(selectedDuration === m ? null : m)}
            />
          ))}
          <OptionButton
            label="Personnalisé"
            selected={selectedDuration === 'custom'}
            available={true}
            onSelect={() => setSelectedDuration(selectedDuration === 'custom' ? null : 'custom')}
          />
        </div>

        {selectedDuration === 'custom' && (
          <input
            type="number"
            min={1}
            max={300}
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
            placeholder="Durée en minutes"
            aria-label="Durée personnalisée en minutes"
            className="mb-6 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoComplete="off"
          />
        )}

        {/* Start button */}
        <button
          type="button"
          disabled={!canStart}
          onClick={startExam}
          className="min-h-[44px] w-full rounded-lg bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {starting ? 'Pr\u00e9paration...' : 'D\u00e9marrer l\u2019examen'}
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
        className="mt-3 min-h-[44px] text-sm font-medium text-primary-500 hover:text-primary-600"
      >
        &larr; Mode entra&icirc;nement
      </button>
    </div>
  );
}

function OptionButton({
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
