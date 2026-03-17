'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMasteryColor, MASTERY_SCALE } from '@/lib/mastery';

interface ActivityCalendarProps {
  sessions: { completed_at: string; question_count: number; score_percent: number }[];
  /** Height in px — should match the ProgressChart height */
  height?: number;
}

function formatDateFr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DayCell {
  dateStr: string;
  count: number;
  avgScore: number | null;
}

const CELL_SIZE = 20; // px
const GAP = 6; // px
const LEGEND_HEIGHT = 32; // px reserved for legend

export default function ActivityCalendar({ sessions, height = 220 }: ActivityCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellCount, setCellCount] = useState(90);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Measure container and calculate how many cells fit
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const cols = Math.floor((w + GAP) / (CELL_SIZE + GAP));
    const rows = Math.floor((h - LEGEND_HEIGHT + GAP) / (CELL_SIZE + GAP));
    const total = Math.max(cols * rows, 30); // at least 30 days
    setCellCount(total);
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [measure]);

  // Aggregate sessions by date
  const byDate = useMemo(() => {
    const map = new Map<string, { count: number; totalWeighted: number; totalWeight: number }>();
    for (const s of sessions) {
      if (!s.completed_at) continue;
      const date = toLocalDateStr(new Date(s.completed_at));
      const existing = map.get(date);
      if (existing) {
        existing.count += s.question_count;
        existing.totalWeighted += s.score_percent * s.question_count;
        existing.totalWeight += s.question_count;
      } else {
        map.set(date, {
          count: s.question_count,
          totalWeighted: s.score_percent * s.question_count,
          totalWeight: s.question_count,
        });
      }
    }
    return map;
  }, [sessions]);

  // Build exactly cellCount days ending today
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: DayCell[] = [];
    for (let i = cellCount - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateStr = toLocalDateStr(d);
      const data = byDate.get(dateStr);
      result.push({
        dateStr,
        count: data?.count ?? 0,
        avgScore: data && data.totalWeight > 0
          ? Math.round(data.totalWeighted / data.totalWeight)
          : null,
      });
    }
    return result;
  }, [cellCount, byDate]);

  // Compute columns from container width
  const cols = useMemo(() => {
    const el = containerRef.current;
    if (!el) return 15;
    return Math.floor((el.clientWidth + GAP) / (CELL_SIZE + GAP));
  }, [cellCount]); // eslint-disable-line react-hooks/exhaustive-deps

  function getCellStyle(day: DayCell): React.CSSProperties {
    if (day.count <= 0) return { backgroundColor: '#F3F4F6' };
    return { backgroundColor: getMasteryColor(day.avgScore) };
  }

  function handleCellHover(e: React.MouseEvent, day: DayCell) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parentRect = containerRef.current?.getBoundingClientRect();
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
    <div ref={containerRef} className="relative h-full" style={{ minHeight: height }} data-calendar>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
          gap: `${GAP}px`,
        }}
      >
        {days.map((day, i) => (
          <div
            key={i}
            className="cursor-pointer rounded-sm transition-colors"
            style={{ ...getCellStyle(day), width: CELL_SIZE, height: CELL_SIZE }}
            onMouseEnter={(e) => handleCellHover(e, day)}
            onMouseLeave={() => setTooltip(null)}
            aria-label={`${formatDateFr(day.dateStr)}: ${day.count} questions${day.avgScore !== null ? `, score ${day.avgScore}%` : ''}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-400">
        <span className="mr-0.5">Score :</span>
        {MASTERY_SCALE.filter((l) => l.min >= 0).map((level) => (
          <div key={level.label} className="flex items-center gap-0.5">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: level.color }} />
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
