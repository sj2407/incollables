'use client';

import { useMemo, useState } from 'react';
import { getMasteryColor, MASTERY_SCALE } from '@/lib/mastery';

interface ActivityCalendarProps {
  /** Raw session data: completed_at, question_count, score_percent */
  sessions: { completed_at: string; question_count: number; score_percent: number }[];
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Convert a Date to local YYYY-MM-DD string (avoids UTC shift from toISOString) */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DayCell {
  dateStr: string;
  count: number; // -1 = future, 0 = no activity
  avgScore: number | null;
}

const TOTAL_DAYS = 90;

export default function ActivityCalendar({ sessions }: ActivityCalendarProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const days = useMemo(() => {
    // Aggregate sessions by date
    const byDate = new Map<string, { count: number; totalWeighted: number; totalWeight: number }>();
    for (const s of sessions) {
      if (!s.completed_at) continue;
      const date = toLocalDateStr(new Date(s.completed_at));
      const existing = byDate.get(date);
      if (existing) {
        existing.count += s.question_count;
        existing.totalWeighted += s.score_percent * s.question_count;
        existing.totalWeight += s.question_count;
      } else {
        byDate.set(date, {
          count: s.question_count,
          totalWeighted: s.score_percent * s.question_count,
          totalWeight: s.question_count,
        });
      }
    }

    // Build a flat continuous list: last 90 days ending today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: DayCell[] = [];
    for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateStr = toLocalDateStr(d);
      const data = byDate.get(dateStr);
      const count = data?.count ?? 0;
      const avgScore = data && data.totalWeight > 0
        ? Math.round(data.totalWeighted / data.totalWeight)
        : null;
      result.push({ dateStr, count, avgScore });
    }

    return result;
  }, [sessions]);

  function getCellStyle(day: DayCell): React.CSSProperties {
    if (day.count <= 0) return { backgroundColor: '#F3F4F6' }; // neutral-100
    const color = getMasteryColor(day.avgScore);
    return { backgroundColor: color };
  }

  function handleCellHover(e: React.MouseEvent, day: DayCell) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parentRect = (e.currentTarget as HTMLElement).closest('[data-calendar]')?.getBoundingClientRect();
    if (!parentRect) return;

    const lines = [formatDateFr(day.dateStr)];
    if (day.count === 0) {
      lines.push('Aucune activité');
    } else {
      lines.push(`${day.count} question${day.count > 1 ? 's' : ''}`);
      if (day.avgScore !== null) lines.push(`Score moy. ${day.avgScore}%`);
    }

    setTooltip({
      text: lines.join(' · '),
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top - 4,
    });
  }

  return (
    <div className="relative" data-calendar>
      {/* Continuous grid: each cell = 1 day, left to right, wrapping */}
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14px, 1fr))' }}>
        {days.map((day, i) => (
          <div
            key={i}
            className="aspect-square cursor-pointer rounded-sm transition-colors"
            style={getCellStyle(day)}
            onMouseEnter={(e) => handleCellHover(e, day)}
            onMouseLeave={() => setTooltip(null)}
            aria-label={`${formatDateFr(day.dateStr)}: ${day.count} questions${day.avgScore !== null ? `, score ${day.avgScore}%` : ''}`}
          />
        ))}
      </div>

      {/* Legend — mastery color scale */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-400">
        <span className="mr-0.5">Score :</span>
        {MASTERY_SCALE.filter((l) => l.min >= 0).map((level) => (
          <div key={level.label} className="flex items-center gap-0.5">
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: level.color }}
            />
            <span>{level.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-0.5">
          <div className="h-3 w-3 rounded-sm bg-neutral-100" />
          <span>Pas d&apos;activité</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-white shadow-md whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
