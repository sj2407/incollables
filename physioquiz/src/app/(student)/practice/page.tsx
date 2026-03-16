'use client';

import { isAbandoned } from '@/lib/pause-manager';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import TopicTree from '@/components/ui/TopicTree';
import { useTopics } from '@/hooks/useTopics';
import { PausedSessionCard, type PausedSession } from '@/components/ui/PausedSessionCard';

export default function PracticePage() {
  const router = useRouter();
  const { topics, loading: topicsLoading, error: topicsError, retry: retryTopics } = useTopics();
  const [paused, setPaused] = useState<PausedSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaused = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('sessions')
      .select('id, topic_id, question_count, correct_count, wrong_count, partial_count, paused_at, is_paused, topics(title)')
      .eq('user_id', user.id)
      .eq('is_paused', true)
      .eq('is_completed', false)
      .order('paused_at', { ascending: false });

    const sessions: PausedSession[] = (data ?? []).map((s) => {
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

    setPaused(sessions);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPaused();
  }, [fetchPaused]);

  const isLoading = loading || topicsLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
          S&apos;entraîner
        </h1>
        <div className="mt-6 flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
        S&apos;entraîner
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Choisissez un chapitre pour commencer une session de quiz.
      </p>

      {/* Paused sessions */}
      {paused.length > 0 && (
        <section className="mt-6" aria-labelledby="paused-heading">
          <h2 id="paused-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
            Sessions en cours
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {paused.map((session) => (
              <PausedSessionCard
                key={session.id}
                session={session}
                onResume={() => router.push(`/quiz/play/${session.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Topic tree */}
      <div className="mt-6">
        {topicsError && (
          <div role="alert" className="flex items-center gap-3">
            <p className="text-sm text-error">{topicsError}</p>
            <button
              type="button"
              onClick={retryTopics}
              className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
            >
              Réessayer
            </button>
          </div>
        )}
        {!topicsError && <TopicTree topics={topics} />}
      </div>
    </div>
  );
}
