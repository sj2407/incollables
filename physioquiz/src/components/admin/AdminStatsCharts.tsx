'use client';

import { memo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from 'recharts';

interface DayData {
  day: string;
  session_count: number;
  avg_score: number;
}

interface ChapterScore {
  topic_id: string;
  topic_title: string;
  avg_score: number;
  session_count: number;
  coverage_percent?: number;
  total_questions?: number;
  attempted_questions?: number;
}

interface AdminChartsProps {
  dailyData: DayData[];
  chapterScores: ChapterScore[];
}

export default memo(function AdminStatsCharts({ dailyData, chapterScores }: AdminChartsProps) {
  const brushEnd = dailyData.length - 1;
  const brushStart = Math.max(0, dailyData.length - 14);

  return (
    <div className="mt-8 space-y-8">
      {/* Sessions per day */}
      <section>
        <h2 className="mb-1 text-[1.125rem] font-semibold text-neutral-900">Sessions par jour</h2>
        <p className="mb-3 text-xs text-neutral-500">Glissez la barre pour ajuster la période</p>
        <div className="glass-card p-4" role="img" aria-label="Graphique sessions par jour">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyData} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  const date = new Date(d.day);
                  return (
                    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
                      <p className="font-semibold text-neutral-700">
                        {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-neutral-600">{d.session_count} session{d.session_count !== 1 ? 's' : ''}</p>
                      <p className="text-neutral-600">Score moy. {d.avg_score}%</p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="session_count"
                stroke="#194ce6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#194ce6' }}
              />
              {dailyData.length > 3 && (
                <Brush
                  dataKey="day"
                  height={20}
                  stroke="#d1d5db"
                  fill="#f9fafb"
                  startIndex={brushStart}
                  endIndex={brushEnd}
                  travellerWidth={8}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Score & coverage by chapter */}
      {chapterScores.length > 0 && (
        <section>
          <h2 className="mb-1 text-[1.125rem] font-semibold text-neutral-900">Performance par chapitre</h2>
          <p className="mb-3 text-xs text-neutral-500">Score moyen et couverture — chapitres les plus difficiles en premier</p>
          <div className="glass-card p-4" role="img" aria-label="Graphique performance par chapitre">
            {/* Legend */}
            <div className="mb-3 flex items-center gap-5 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#194ce6]" />Score moyen
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#14b8a6]" />Couverture
              </span>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(220, chapterScores.length * 52)}>
              <BarChart
                data={chapterScores}
                layout="vertical"
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="topic_title"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
                        <p className="mb-1 font-semibold text-neutral-700">{d.topic_title}</p>
                        <p className="text-neutral-600">
                          <span className="inline-block h-2 w-2 rounded-sm bg-[#194ce6]" /> Score moy. <strong>{d.avg_score}%</strong>
                        </p>
                        <p className="text-neutral-600">
                          <span className="inline-block h-2 w-2 rounded-sm bg-[#14b8a6]" /> Couverture <strong>{d.coverage_percent}%</strong>
                          <span className="ml-1 text-neutral-400">({d.attempted_questions}/{d.total_questions} questions)</span>
                        </p>
                        <p className="mt-1 text-neutral-400">{d.session_count} session{d.session_count !== 1 ? 's' : ''}</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="avg_score"
                  radius={[0, 4, 4, 0]}
                  fill="#194ce6"
                  fillOpacity={0.85}
                  name="Score"
                />
                <Bar
                  dataKey="coverage_percent"
                  radius={[0, 4, 4, 0]}
                  fill="#14b8a6"
                  fillOpacity={0.7}
                  name="Couverture"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
});
