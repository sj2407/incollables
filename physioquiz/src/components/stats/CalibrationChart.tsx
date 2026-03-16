'use client';

import { memo, useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  Cell,
} from 'recharts';

interface FalseCertainty {
  question_id: string;
  question_text: string;
  question_number: number | null;
  topic_title: string;
  score_percent: number;
}

interface CalibrationData {
  levels: unknown;
  false_certainties: FalseCertainty[] | null;
}

interface CalibrationAnswer {
  confidence: number;
  score_percent: number;
}

interface CalibrationChartProps {
  data: CalibrationData;
  answers: CalibrationAnswer[];
  confidenceFillRate: number;
  /** Compact mode for dashboard encart */
  compact?: boolean;
}

const CONFIDENCE_LABELS: Record<number, string> = {
  0: 'Je devine',
  0.5: 'Hésitant',
  1: 'Sûr',
};

// Match BRAND.md confidence button selected colors
const CONFIDENCE_COLORS: Record<number, string> = {
  0: '#B45309',   // warning-amber (Je devine)
  0.5: '#194ce6', // primary (Hésitant)
  1: '#10B981',   // secondary-500 (Sûr)
};

// Map confidence to X position (categorical spacing)
const CONFIDENCE_X: Record<number, number> = {
  0: 1,
  0.5: 2,
  1: 3,
};

// Seeded pseudo-random for consistent jitter
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export default memo(function CalibrationChart({
  data,
  answers,
  confidenceFillRate,
  compact = false,
}: CalibrationChartProps) {
  // Build scatter data from individual answers with jitter on X
  const scatterData = useMemo(() => {
    return answers
      .filter((a) => a.confidence in CONFIDENCE_X)
      .map((a, i) => {
        const baseX = CONFIDENCE_X[a.confidence];
        const jitter = (seededRandom(i) - 0.5) * 0.4; // ±0.2 spread
        return {
          x: baseX + jitter,
          y: a.score_percent,
          confidence: a.confidence,
          label: CONFIDENCE_LABELS[a.confidence],
        };
      });
  }, [answers]);

  // Compute averages per confidence level for compact mode
  const averages = useMemo(() => {
    const groups: Record<number, { total: number; count: number }> = {};
    for (const a of answers) {
      if (!(a.confidence in CONFIDENCE_LABELS)) continue;
      if (!groups[a.confidence]) groups[a.confidence] = { total: 0, count: 0 };
      groups[a.confidence].total += a.score_percent;
      groups[a.confidence].count += 1;
    }
    return [0, 0.5, 1].map((conf) => ({
      label: CONFIDENCE_LABELS[conf],
      avg: groups[conf] ? Math.round(groups[conf].total / groups[conf].count) : 0,
      count: groups[conf]?.count ?? 0,
    }));
  }, [answers]);

  const falseCertainties = data.false_certainties ?? [];

  // Show incentive if < 30% fill rate
  if (confidenceFillRate < 30) {
    return (
      <div>
        <p className="text-sm text-neutral-500">
          Indiquez votre confiance sur plus de réponses pour débloquer ce graphique.
        </p>
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(confidenceFillRate / 30 * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {Math.round(confidenceFillRate)}% / 30% requis
          </p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div>
        <div className="grid grid-cols-3 gap-2">
          {averages.map((d) => (
            <div key={d.label} className="text-center">
              <p className="text-lg font-bold text-neutral-900">{d.avg}%</p>
              <p className="text-xs text-neutral-500">{d.label}</p>
              <p className="text-[10px] text-neutral-400">{d.count} rép.</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Screen reader summary
  const srSummary = averages
    .map((d) => `${d.label}: ${d.avg}% réussite moyenne, ${d.count} réponses`)
    .join('. ');

  // Full scatter chart: individual answer dots
  return (
    <div>
      <div aria-label="Graphique de calibration" role="img">
        <p className="sr-only">{srSummary}</p>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0.4, 3.6]}
              ticks={[1, 2, 3]}
              tickFormatter={(v: number) => CONFIDENCE_LABELS[{ 1: 0, 2: 0.5, 3: 1 }[v] ?? 0] ?? ''}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload;
                if (!item) return null;
                return (
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-neutral-700">{item.label}</p>
                    <p className="mt-1 text-neutral-600">Score : {Math.round(item.y)}%</p>
                  </div>
                );
              }}
            />
            <Scatter data={scatterData}>
              {scatterData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={CONFIDENCE_COLORS[entry.confidence]}
                  fillOpacity={0.6}
                  r={5}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[10px] text-neutral-500">
          {[0, 0.5, 1].map((conf) => (
            <span key={conf} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[conf] }} />
              {CONFIDENCE_LABELS[conf]}
            </span>
          ))}
        </div>
      </div>

      {/* False certainties */}
      {falseCertainties.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-neutral-700">
            Fausses certitudes ({falseCertainties.length})
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Questions où vous étiez sûr mais la réponse était fausse
          </p>
          <div className="mt-2 max-h-[300px] overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50/50">
            <div className="flex flex-col gap-1.5 p-2">
              {falseCertainties.map((fc) => {
                const scoreColor = fc.score_percent >= 40 ? 'text-warning' : 'text-error';
                return (
                  <div
                    key={fc.question_id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-700 line-clamp-1">
                        {fc.question_number ? `Q${fc.question_number}. ` : ''}
                        {fc.question_text}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {fc.topic_title}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-bold ${scoreColor}`}>
                      {fc.score_percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
