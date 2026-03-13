'use client';

import TopicTree from '@/components/ui/TopicTree';
import { useTopics } from '@/hooks/useTopics';

export default function TopicsPage() {
  const { topics, loading, error, retry } = useTopics();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
        Navigation des cours
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Choisissez un chapitre pour commencer une session de quiz.
      </p>

      <div className="mt-6">
        {loading && <TopicTreeSkeleton />}
        {error && (
          <div role="alert" className="flex items-center gap-3">
            <p className="text-sm text-error">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary-500 hover:bg-primary-50"
            >
              Réessayer
            </button>
          </div>
        )}
        {!loading && !error && <TopicTree topics={topics} />}
      </div>
    </div>
  );
}

function TopicTreeSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100"
        />
      ))}
    </div>
  );
}
