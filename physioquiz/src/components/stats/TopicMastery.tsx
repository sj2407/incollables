'use client';

import { memo } from 'react';
import { getMasteryColor, getMasteryLabel } from '@/lib/mastery';

export interface TopicMasteryData {
  topic_id: string;
  title: string;
  mastery_percent: number | null;
  coverage_percent: number;
  total_questions: number;
  attempted_questions: number;
}

interface TopicMasteryProps {
  data: TopicMasteryData[];
  /** Max items to display (default: all) */
  limit?: number;
}

export default memo(function TopicMastery({ data, limit }: TopicMasteryProps) {
  if (data.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-neutral-400">
        Aucune donnée de maîtrise disponible.
      </p>
    );
  }

  // Sort weakest first (null mastery = not attempted, sorted last)
  const sorted = [...data].sort((a, b) => {
    const ma = a.mastery_percent ?? -1;
    const mb = b.mastery_percent ?? -1;
    if (ma < 0 && mb < 0) return 0;
    if (ma < 0) return 1;
    if (mb < 0) return -1;
    return ma - mb;
  });

  const visible = limit ? sorted.slice(0, limit) : sorted;

  return (
    <div className="flex flex-col gap-3">
      {visible.map((topic) => {
        const mastery = topic.mastery_percent ?? -1;
        const barWidth = mastery >= 0 ? Math.max(mastery, 2) : 0;
        const color = getMasteryColor(topic.mastery_percent);

        return (
          <div key={topic.topic_id}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-neutral-700">
                {topic.title}
              </p>
              <span className="shrink-0 text-xs font-semibold" style={{ color }}>
                {mastery >= 0 ? `${Math.round(mastery)}%` : 'Non tenté'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-neutral-100">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="shrink-0 text-[10px] text-neutral-400">
                {topic.attempted_questions}/{topic.total_questions}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-neutral-400">
              {getMasteryLabel(topic.mastery_percent)} · Couverture {Math.round(topic.coverage_percent)}%
            </p>
          </div>
        );
      })}
    </div>
  );
});
