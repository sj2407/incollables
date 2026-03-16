'use client';

import { memo } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
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

  // Default brush: show last 30 days of data points (or all if fewer)
  const brushStartIndex = Math.max(0, chartData.length - 30);

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
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
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
            <Brush
              dataKey="date"
              height={25}
              stroke="#2B7DE9"
              fill="#f9fafb"
              startIndex={brushStartIndex}
              endIndex={chartData.length - 1}
              tickFormatter={() => ''}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
