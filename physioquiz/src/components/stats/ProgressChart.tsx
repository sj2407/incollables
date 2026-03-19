'use client';

import { memo } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  Bar,
  Brush,
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
  topics?: string[];
  height?: number;
}

export default memo(function ProgressChart({
  data,
  height = 240,
}: ProgressChartProps) {
  const hasQuestionCounts = data.some((d) => d.question_count != null && d.question_count > 0);

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    score: d.score,
    ...(hasQuestionCounts ? { question_count: d.question_count ?? 0 } : {}),
  }));

  const maxQuestions = hasQuestionCounts
    ? Math.max(...data.map((d) => d.question_count ?? 0), 1)
    : 0;

  // Default brush: show last 30 data points (or all if fewer)
  const brushEnd = chartData.length - 1;
  const brushStart = Math.max(0, chartData.length - 30);

  return (
    <div aria-label="Évolution des scores" role="img">
      {/* Screen reader summary */}
      {chartData.length > 0 && (
        <p className="sr-only">
          {chartData.length} sessions.
          Score moyen : {Math.round(chartData.reduce((a, b) => a + b.score, 0) / chartData.length)}%.
        </p>
      )}

      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">
          Aucune donnée sur cette période.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }} style={{ background: 'linear-gradient(180deg, #f8faff 0%, #ffffff 100%)', borderRadius: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e4eb" strokeOpacity={0.4} />
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
              contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '8px 12px' }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#194ce6" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#194ce6" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d1d5db" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#e5e7eb" stopOpacity={0.3} />
              </linearGradient>
              <filter id="lineShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#194ce6" floodOpacity="0.2" />
              </filter>
            </defs>
            {hasQuestionCounts && (
              <Bar
                yAxisId="right"
                dataKey="question_count"
                fill="url(#barGradient)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={true}
                animationDuration={600}
              />
            )}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="score"
              stroke="#194ce6"
              strokeWidth={2.5}
              fill="url(#scoreGradient)"
              dot={{ r: 3.5, fill: '#194ce6', stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: '#194ce6', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
              style={{ filter: 'url(#lineShadow)' }}
            />
            {chartData.length > 3 && (
              <Brush
                dataKey="date"
                height={20}
                stroke="#d1d5db"
                fill="#f9fafb"
                startIndex={brushStart}
                endIndex={brushEnd}
                travellerWidth={8}
                tickFormatter={() => ''}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
