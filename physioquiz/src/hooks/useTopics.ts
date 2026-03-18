'use client';

import { createClient } from '@/lib/supabase/client';
import type { Topic } from '@/types';
import { useCallback, useEffect, useState } from 'react';

export interface TopicWithCount extends Topic {
  questionCount: number;
  children: TopicWithCount[];
}

/**
 * Build a nested tree from a flat array of topics using parent_id.
 */
export function buildTopicTree(flatTopics: TopicWithCount[]): TopicWithCount[] {
  const map = new Map<string, TopicWithCount>();
  const roots: TopicWithCount[] = [];

  for (const topic of flatTopics) {
    topic.children = [];
    map.set(topic.id, topic);
  }

  for (const topic of flatTopics) {
    if (topic.parent_id && map.has(topic.parent_id)) {
      map.get(topic.parent_id)!.children.push(topic);
    } else {
      roots.push(topic);
    }
  }

  return roots;
}

/**
 * Recursively sum question counts including all descendants.
 */
export function getTotalQuestionCount(topic: TopicWithCount): number {
  let total = topic.questionCount;
  for (const child of topic.children) {
    total += getTotalQuestionCount(child);
  }
  return total;
}

/**
 * Fetch active topics + question counts, return flat array with counts.
 */
export async function fetchTopicsWithCounts(
  supabase: ReturnType<typeof createClient>,
): Promise<{ data: TopicWithCount[]; error: string | null }> {
  // Students read from published_topics (isolation from admin edits)
  const { data: topicsData, error: topicsError } = await supabase
    .from('published_topics')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (topicsError) {
    return { data: [], error: 'Impossible de charger les cours.' };
  }

  // Fetch question counts grouped by topic via RPC, with fallback
  const countMap: Record<string, number> = {};

  const { data: countsData, error: countsError } = await supabase
    .rpc('get_question_counts_by_topic');

  if (countsError || !countsData) {
    // Fallback: fetch from published_questions
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('published_questions')
      .select('topic_id')
      .eq('is_active', true);

    if (fallbackError || !fallbackData) {
      return { data: [], error: 'Impossible de charger le nombre de questions.' };
    }

    for (const row of fallbackData) {
      countMap[row.topic_id] = (countMap[row.topic_id] ?? 0) + 1;
    }
  } else {
    for (const row of countsData) {
      countMap[row.topic_id] = Number(row.question_count);
    }
  }

  const flatTopics: TopicWithCount[] = (topicsData ?? []).map((t) => ({
    ...(t as Topic),
    questionCount: countMap[t.id] ?? 0,
    children: [],
  }));

  return { data: flatTopics, error: null };
}

/**
 * Fetch active topics from Supabase and build a nested tree.
 * Each node includes a questionCount (direct questions only).
 */
export function useTopics() {
  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [loading, setLoading] = useState(true);
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
    setTopics(tree);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { topics, loading, error, retry: fetchData };
}
