'use client';

import { memo } from 'react';
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Scatter,
  ComposedChart,
} from 'recharts';

interface CalibrationLevel {
  confidence_level: number;
  total_answers: number;
  correct_answers: number;
  success_rate: number;
}

interface FalseCertainty {
  question_id: string;
  question_text: string;
  question_number: number | null;
  topic_title: string;
  score_percent: number;
}

interface CalibrationData {
  levels: CalibrationLevel[] | null;
  false_certainties: FalseCertainty[] | null;
}

interface CalibrationChartProps {
  data: CalibrationData;
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
  0: '#F59E0B',   // warning (Je devine)
  0.5: '#3B82F6', // info (Hésitant)
  1: '#10B981',   // secondary-500 (Sûr)
};

// Perfect calibration reference points
const PERFECT_CALIBRATION: Record<number, number> = {
  0: 25,
  0.5: 55,
  1: 90,
};

export default memo(function CalibrationChart({
  data,
  confidenceFillRate,
  compact = false,
}: CalibrationChartProps) {
  // Show incentive if < 30% fill rate
  if (confidenceFillRate < 30) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
        <p className="text-sm font-semibold text-neutral-700">Calibration</p>
        <p className="mt-2 text-sm text-neutral-500">
          Indiquez votre confiance sur plus de réponses pour débloquer ce graphique.
        </p>
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-primary-500 transition-all"
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

  const levels = data.levels ?? [];
  const chartData = [0, 0.5, 1].map((conf) => {
    const level = levels.find((l) => Number(l.confidence_level) === conf);
    return {
      label: CONFIDENCE_LABELS[conf],
      success_rate: level ? Number(level.success_rate) : 0,
      total: level ? Number(level.total_answers) : 0,
      perfect: PERFECT_CALIBRATION[conf],
      confidence: conf,
    };
  });

  const falseCertainties = data.false_certainties ?? [];

  // Screen reader summary
  const srSummary = chartData
    .map((d) => `${d.label}: ${Math.round(d.success_rate)}% réussite (idéal ${d.perfect}%), ${d.total} réponses`)
    .join('. ');

  if (compact) {
    // Dashboard encart: just 3 numbers
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
        <p className="text-sm font-semibold text-neutral-700">Calibration</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {chartData.map((d) => (
            <div key={d.label} className="text-center">
              <p className="text-lg font-bold text-neutral-900">{Math.round(d.success_rate)}%</p>
              <p className="text-xs text-neutral-500">{d.label}</p>
              <p className="text-[10px] text-neutral-400">{d.total} rép.</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full chart
  return (
    <div>
      <div aria-label="Graphique de calibration" role="img">
        {/* Screen reader accessible summary */}
        <p className="sr-only">{srSummary}</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'success_rate') return [`${value}%`, 'Taux de réussite'];
                return [`${value}%`, 'Calibration idéale'];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="success_rate" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {chartData.map((entry) => (
                <Cell key={entry.label} fill={CONFIDENCE_COLORS[entry.confidence]} />
              ))}
            </Bar>
            {/* Perfect calibration reference as scatter dots */}
            <Scatter
              dataKey="perfect"
              fill="#111827"
              shape="diamond"
              legendType="diamond"
              name="Calibration idéale"
            />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Legend for perfect calibration markers */}
        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="inline-block h-2 w-2 rotate-45 bg-neutral-900" />
          <span className="text-[10px] text-neutral-500">Calibration idéale</span>
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
          <div className="mt-2 flex flex-col gap-1.5">
            {falseCertainties.map((fc) => (
              <div
                key={fc.question_id}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-2.5"
              >
                <p className="text-sm text-neutral-700 line-clamp-1">
                  {fc.question_number ? `Q${fc.question_number}. ` : ''}
                  {fc.question_text}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {fc.topic_title} · {fc.score_percent}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
