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
}

interface AdminChartsProps {
  dailyData: DayData[];
  chapterScores: ChapterScore[];
}

export default memo(function AdminStatsCharts({ dailyData, chapterScores }: AdminChartsProps) {
  return (
    <div className="mt-8 space-y-8">
      {/* Sessions per day */}
      <section>
        <h2 className="mb-1 text-[1.125rem] font-semibold text-neutral-900">Sessions par jour</h2>
        <p className="mb-3 text-xs text-neutral-500">30 derniers jours</p>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md" role="img" aria-label="Graphique sessions par jour">
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Score by chapter */}
      {chapterScores.length > 0 && (
        <section>
          <h2 className="mb-1 text-[1.125rem] font-semibold text-neutral-900">Score moyen par chapitre</h2>
          <p className="mb-3 text-xs text-neutral-500">Chapitres les plus difficiles en premier</p>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md" role="img" aria-label="Graphique score par chapitre">
            <ResponsiveContainer width="100%" height={Math.max(200, chapterScores.length * 36)}>
              <BarChart
                data={chapterScores}
                layout="vertical"
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
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
                        <p className="font-semibold text-neutral-700">{d.topic_title}</p>
                        <p className="text-neutral-600">Score moy. {d.avg_score}%</p>
                        <p className="text-neutral-600">{d.session_count} session{d.session_count !== 1 ? 's' : ''}</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="avg_score"
                  radius={[0, 4, 4, 0]}
                  fill="#194ce6"
                  fillOpacity={0.7}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
});
