'use client';

import { memo, useState } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  Bar,
  ComposedChart,
} from 'recharts';

interface ProgressDataPoint {
  date: string;
  score: number;
  topic?: string;
  session_type?: string;
  question_count?: number;
}

interface ProgressChartProps {
  data: ProgressDataPoint[];
  /** Show date range toggle (30d / 90d) */
  showToggle?: boolean;
  /** Show topic/type filters (for full progress page) */
  showFilters?: boolean;
  topics?: string[];
  height?: number;
}

export default memo(function ProgressChart({
  data,
  showToggle = true,
  showFilters = false,
  topics = [],
  height = 240,
}: ProgressChartProps) {
  const [days, setDays] = useState<30 | 90>(30);
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const filtered = data.filter((d) => {
    if (new Date(d.date) < cutoff) return false;
    if (filterTopic !== 'all' && d.topic !== filterTopic) return false;
    if (filterType !== 'all' && d.session_type !== filterType) return false;
    return true;
  });

  const hasQuestionCounts = filtered.some((d) => d.question_count != null && d.question_count > 0);

  const chartData = filtered.map((d) => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    score: d.score,
    ...(hasQuestionCounts ? { question_count: d.question_count ?? 0 } : {}),
  }));

  const maxQuestions = hasQuestionCounts
    ? Math.max(...filtered.map((d) => d.question_count ?? 0), 1)
    : 0;

  return (
    <div aria-label="Évolution des scores" role="img">
      {/* Screen reader summary */}
      {chartData.length > 0 && (
        <p className="sr-only">
          {chartData.length} sessions sur {days} jours.
          Score moyen : {Math.round(chartData.reduce((a, b) => a + b.score, 0) / chartData.length)}%.
        </p>
      )}
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {showToggle && (
          <div className="flex gap-1">
            {([30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  days === d
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
        )}
        {showFilters && topics.length > 0 && (
          <>
            <select
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              aria-label="Filtrer par cours"
              className="min-h-[44px] rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-700"
            >
              <option value="all">Tous les cours</option>
              {topics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filtrer par type"
              className="min-h-[44px] rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-700"
            >
              <option value="all">Tous les types</option>
              <option value="short">Entraînement</option>
              <option value="exam">Examen</option>
            </select>
          </>
        )}
      </div>

      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">
          Aucune donnée sur cette période.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 5, right: hasQuestionCounts ? 5 : 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            {hasQuestionCounts && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, Math.ceil(maxQuestions * 1.2)]}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}q`}
              />
            )}
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                if (name === 'question_count') return [`${value} questions`, 'Questions'];
                return [`${value}%`, 'Score'];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <ReferenceLine yAxisId="left" y={75} stroke="#2ECC71" strokeDasharray="4 4" label={{ value: '75%', fontSize: 10, fill: '#2ECC71' }} />
            {hasQuestionCounts && (
              <Bar
                yAxisId="right"
                dataKey="question_count"
                fill="#e5e7eb"
                radius={[2, 2, 0, 0]}
                maxBarSize={20}
              />
            )}
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2B7DE9" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2B7DE9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="score"
              stroke="#2B7DE9"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              dot={{ r: 3, fill: '#2B7DE9' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
