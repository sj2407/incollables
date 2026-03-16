'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MetricCard, ChartIcon, SessionsIcon, TimerIcon, FlaskIcon } from '@/components/stats/MetricCards';
import { WeakQuestionsSection, type WeakQuestion } from '@/components/stats/WeakQuestions';
import type { HeatmapNode } from '@/components/stats/Heatmap';

const ProgressChart = dynamic(() => import('@/components/stats/ProgressChart'), { ssr: false });
const CalibrationChart = dynamic(() => import('@/components/stats/CalibrationChart'), { ssr: false });
const Heatmap = dynamic(() => import('@/components/stats/Heatmap'), { ssr: false });

interface DashboardStats {
  avg_score_this_week: number | null;
  session_count_this_week: number;
  total_study_minutes: number;
  partial_count: number;
  confidence_fill_rate: number;
}

interface WeekTrends {
  scoreDelta: number | null; // percentage point change
  sessionsDelta: number | null;
  timeDelta: number | null;
  partialDelta: number | null;
}

interface ProgressPoint {
  date: string;
  score: number;
  topic?: string;
  session_type?: string;
  question_count?: number;
}

interface CalibrationData {
  levels: { confidence_level: number; total_answers: number; correct_answers: number; success_rate: number }[] | null;
  false_certainties: { question_id: string; question_text: string; question_number: number | null; topic_title: string; score_percent: number }[] | null;
}

interface CalibrationAnswer {
  confidence: number;
  score_percent: number;
}

interface SessionHistory {
  id: string;
  topic_title: string;
  score_percent: number;
  completed_at: string;
  question_count: number;
  session_type: string;
}

export default function StatsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [calibrationAnswers, setCalibrationAnswers] = useState<CalibrationAnswer[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapNode[]>([]);
  const [weakQuestions, setWeakQuestions] = useState<WeakQuestion[]>([]);
  const [sessions, setSessions] = useState<SessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Page-level type filter
  const [filterType, setFilterType] = useState<string>('all');

  // Session history controls
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [historyTopicFilter, setHistoryTopicFilter] = useState<string>('');
  const [historySearchOpen, setHistorySearchOpen] = useState(false);

  const fetchData = useCallback(async (sessionType: string) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Non connecté.');
      setLoading(false);
      return;
    }

    // RPC session_type param: null means all, otherwise the enum value
    const rpcType = sessionType === 'all' ? null : sessionType;

    // session_type filter: 'short' means training (short + all), 'exam' means exam only
    const typeValues = rpcType === 'short' ? ['short', 'all'] : rpcType === 'exam' ? ['exam'] : null;

    // Build session history query with optional type filter
    let sessionQuery = supabase
      .from('sessions')
      .select('id, score_percent, completed_at, question_count, session_type, topics(title)')
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(20);
    if (typeValues) {
      sessionQuery = sessionQuery.in('session_type', typeValues);
    }

    // Build progress query with optional type filter
    let progressQuery = supabase
      .from('sessions')
      .select('completed_at, score_percent, session_type, question_count, topics(title)')
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .gte('completed_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('completed_at', { ascending: true });
    if (typeValues) {
      progressQuery = progressQuery.in('session_type', typeValues);
    }

    // Build calibration answers query (individual answer dots)
    let calibAnswersQuery = supabase
      .from('session_answers')
      .select('confidence, score_percent, sessions!inner(user_id, is_completed, session_type)')
      .eq('sessions.user_id', user.id)
      .eq('sessions.is_completed', true)
      .not('confidence', 'is', null);
    if (typeValues) {
      calibAnswersQuery = calibAnswersQuery.in('sessions.session_type', typeValues);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcParams = (base: Record<string, any>) =>
      rpcType ? { ...base, p_session_type: rpcType } : base;

    const [statsResult, progressResult, calibrationResult, masteryResult, weakResult, sessionResult, calibAnswersResult] =
      await Promise.all([
        supabase.rpc('get_dashboard_stats', rpcParams({ p_user_id: user.id })),
        progressQuery,
        supabase.rpc('get_calibration_data', rpcParams({ p_user_id: user.id })),
        supabase.rpc('get_topic_mastery_detailed', rpcParams({ p_user_id: user.id })),
        supabase.rpc('get_weak_questions', rpcParams({ p_user_id: user.id })),
        sessionQuery,
        calibAnswersQuery,
      ]);

    // Stats
    if (statsResult.data && !statsResult.error) {
      const s = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data;
      if (s) {
        setStats({
          avg_score_this_week: s.avg_score_this_week != null ? Number(s.avg_score_this_week) : null,
          session_count_this_week: Number(s.total_sessions_this_week ?? 0),
          total_study_minutes: Math.round(Number(s.total_study_time_seconds ?? 0) / 60),
          partial_count: Number(s.partial_answer_count ?? 0),
          confidence_fill_rate: Number(s.confidence_fill_rate ?? 0),
        });
      }
    }

    // Progress
    if (progressResult.data && !progressResult.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const points: ProgressPoint[] = (progressResult.data as any[]).map((d) => ({
        date: d.completed_at,
        score: Number(d.score_percent ?? 0),
        question_count: Number(d.question_count ?? 0),
      }));
      setProgress(points);
    }

    // Calibration (aggregated for false certainties)
    if (calibrationResult.data && !calibrationResult.error) {
      setCalibration(calibrationResult.data as CalibrationData);
    }

    // Calibration individual answers
    if (calibAnswersResult.data && !calibAnswersResult.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCalibrationAnswers((calibAnswersResult.data as any[]).map((a) => ({
        confidence: Number(a.confidence),
        score_percent: Number(a.score_percent),
      })));
    }

    // Topic mastery (filter to attempted only)
    if (masteryResult.data && !masteryResult.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allMastery = (masteryResult.data as any[]).map((t) => ({
        topic_id: t.topic_id,
        title: t.title ?? t.topic_title ?? '',
        mastery_percent: t.mastery_percent != null ? Number(t.mastery_percent) : null,
        coverage_percent: Number(t.coverage ?? t.coverage_percent ?? 0),
        total_questions: Number(t.question_count ?? t.total_questions ?? 0),
        attempted_questions: Number(t.questions_attempted ?? t.attempted_questions ?? 0),
      }));

      const attempted = allMastery.filter((t) => t.attempted_questions > 0);

      const nodes: HeatmapNode[] = attempted.map((t) => ({
        name: t.title,
        topic_id: t.topic_id,
        size: Math.max(t.total_questions, 1),
        mastery: t.mastery_percent,
        coverage: t.coverage_percent,
      }));
      setHeatmapData(nodes);
    }

    // Weak questions
    if (weakResult.data && !weakResult.error) {
      setWeakQuestions(
        (weakResult.data as WeakQuestion[]).map((q) => ({
          question_id: q.question_id,
          question_text: q.question_text,
          question_number: q.question_number,
          topic_title: q.topic_title,
          avg_score: Number(q.avg_score),
          attempt_count: Number(q.attempt_count),
        }))
      );
    }

    // Session history
    if (sessionResult.data && !sessionResult.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSessions((sessionResult.data as any[]).map((s) => {
        const topicData = (Array.isArray(s.topics) ? s.topics[0] : s.topics) as { title: string } | null;
        return {
          id: s.id,
          topic_title: topicData?.title ?? 'Sans cours',
          score_percent: Number(s.score_percent ?? 0),
          completed_at: s.completed_at ?? '',
          question_count: Number(s.question_count),
          session_type: s.session_type ?? 'short',
        };
      }));
    }

    setLoading(false);
  }, []);

  // Re-fetch everything when filter changes
  useEffect(() => {
    fetchData(filterType);
  }, [fetchData, filterType]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
            Mes résultats
          </h1>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filtrer par type de session"
            className="min-h-[44px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tous les types</option>
            <option value="short">Entraînement</option>
            <option value="exam">Examen</option>
          </select>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
          Mes résultats
        </h1>
        <p role="alert" className="mt-4 text-sm text-error">{error}</p>
        <button
          type="button"
          onClick={() => fetchData(filterType)}
          className="mt-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const avgScore = stats?.avg_score_this_week;
  const studyHours = stats ? Math.round(stats.total_study_minutes / 60) : 0;
  const studyMinutes = stats ? stats.total_study_minutes % 60 : 0;

  // Compute week-over-week trends from sessions
  const trends = (() => {
    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 86400000);
    const lastWeekStart = new Date(now.getTime() - 14 * 86400000);

    const thisWeekSessions = sessions.filter(
      (s) => new Date(s.completed_at) >= thisWeekStart
    );
    const lastWeekSessions = sessions.filter(
      (s) => {
        const d = new Date(s.completed_at);
        return d >= lastWeekStart && d < thisWeekStart;
      }
    );

    const thisWeekAvg =
      thisWeekSessions.length > 0
        ? Math.round(thisWeekSessions.reduce((a, s) => a + s.score_percent, 0) / thisWeekSessions.length)
        : null;
    const lastWeekAvg =
      lastWeekSessions.length > 0
        ? Math.round(lastWeekSessions.reduce((a, s) => a + s.score_percent, 0) / lastWeekSessions.length)
        : null;

    const thisWeekTime = stats?.total_study_minutes ?? 0;
    // Rough estimate: scale last week proportionally from session count
    const lastWeekTime =
      lastWeekSessions.length > 0 && thisWeekSessions.length > 0
        ? Math.round(thisWeekTime * (lastWeekSessions.length / thisWeekSessions.length))
        : 0;

    const thisWeekPartials = stats?.partial_count ?? 0;

    return {
      scoreDelta:
        thisWeekAvg !== null && lastWeekAvg !== null
          ? thisWeekAvg - lastWeekAvg
          : null,
      sessionsDelta:
        lastWeekSessions.length > 0
          ? Math.round(
              ((thisWeekSessions.length - lastWeekSessions.length) / lastWeekSessions.length) * 100
            )
          : null,
      timeDelta:
        lastWeekTime > 0
          ? Math.round(((thisWeekTime - lastWeekTime) / lastWeekTime) * 100)
          : null,
      partialDelta: null as number | null, // no previous data for partials
    };
  })();

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header with page-level filter */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">
          Mes résultats
        </h1>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filtrer par type de session"
          className="min-h-[44px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">Tous les types</option>
          <option value="short">Entraînement</option>
          <option value="exam">Examen</option>
        </select>
      </div>

      {/* 1. Metric cards — 2×2 grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard
          label="Score hebdo"
          value={avgScore != null ? `${Math.round(avgScore)}%` : '—'}
          icon={<ChartIcon color="#194ce6" />}
          borderColor="#194ce6"
          trend={trends.scoreDelta !== null ? { value: trends.scoreDelta, label: 'vs sem. dernière' } : undefined}
        />
        <MetricCard
          label="Sessions"
          value={String(stats?.session_count_this_week ?? 0)}
          icon={<SessionsIcon color="#0ea5e9" />}
          borderColor="#0ea5e9"
          trend={trends.sessionsDelta !== null ? { value: trends.sessionsDelta, label: trends.sessionsDelta === 0 ? 'stable' : 'vs sem. dernière' } : undefined}
        />
        <MetricCard
          label="Temps d'étude"
          value={studyHours > 0 ? `${studyHours}h${studyMinutes > 0 ? `${studyMinutes}` : ''}` : `${studyMinutes}min`}
          icon={<TimerIcon color="#B45309" />}
          borderColor="#B45309"
          trend={trends.timeDelta !== null ? { value: trends.timeDelta, label: 'vs sem. dernière' } : undefined}
        />
        <MetricCard
          label="Partielles"
          value={String(stats?.partial_count ?? 0)}
          icon={<FlaskIcon color="#6366f1" />}
          borderColor="#6366f1"
          trend={trends.partialDelta !== null ? { value: trends.partialDelta, label: 'vs sem. dernière' } : undefined}
        />
      </div>

      {/* 2. Progress chart */}
      <section className="mt-6" aria-labelledby="scores-heading">
        <h2 id="scores-heading" className="mb-3 text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
          Progression
        </h2>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
          <ProgressChart data={progress} height={260} />
        </div>
      </section>

      {/* 3. Heatmap (attempted topics only) */}
      {heatmapData.length > 0 && (
        <section className="mt-6" aria-labelledby="heatmap-heading">
          <h2 id="heatmap-heading" className="mb-3 text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
            Carte des connaissances
          </h2>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
            <Heatmap data={heatmapData} />
          </div>
        </section>
      )}

      {/* 4. Calibration */}
      <section className="mt-6" aria-labelledby="calibration-heading">
        <h2 id="calibration-heading" className="mb-1 text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
          Calibration
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Votre taux de réussite réel vs votre confiance déclarée
        </p>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6">
          <CalibrationChart
            data={calibration ?? { levels: null, false_certainties: null }}
            answers={calibrationAnswers}
            confidenceFillRate={stats?.confidence_fill_rate ?? 0}
          />
        </div>
      </section>

      {/* 5. Weak questions */}
      {weakQuestions.length > 0 && (
        <WeakQuestionsSection questions={weakQuestions} />
      )}

      {/* 6. Session history */}
      {sessions.length > 0 && (() => {
        const topicNames = Array.from(new Set(sessions.map((s) => s.topic_title))).sort();
        const searchLower = historyTopicFilter.toLowerCase();
        const filteredSessions = historyTopicFilter === ''
          ? sessions
          : sessions.filter((s) => s.topic_title.toLowerCase().includes(searchLower));
        const matchingTopics = historyTopicFilter === ''
          ? []
          : topicNames.filter((t) => t.toLowerCase().includes(searchLower));
        const visibleSessions = showAllSessions ? filteredSessions : filteredSessions.slice(0, 3);
        const hasMore = filteredSessions.length > 3;

        return (
          <section className="mt-6" aria-labelledby="history-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="history-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
                Historique des sessions
              </h2>
              {topicNames.length > 1 && (
                <div className="relative">
                  <input
                    type="text"
                    value={historyTopicFilter}
                    onChange={(e) => { setHistoryTopicFilter(e.target.value); setShowAllSessions(false); setHistorySearchOpen(true); }}
                    onFocus={() => setHistorySearchOpen(true)}
                    onBlur={() => setTimeout(() => setHistorySearchOpen(false), 150)}
                    placeholder="Filtrer par cours…"
                    aria-label="Filtrer par cours"
                    className="min-h-[44px] w-[180px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {historyTopicFilter && (
                    <button
                      type="button"
                      onClick={() => { setHistoryTopicFilter(''); setShowAllSessions(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                      aria-label="Effacer le filtre"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  )}
                  {historySearchOpen && historyTopicFilter && matchingTopics.length > 0 && (
                    <ul className="absolute right-0 top-full z-10 mt-1 max-h-40 w-[220px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                      {matchingTopics.map((t) => (
                        <li key={t}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setHistoryTopicFilter(t); setHistorySearchOpen(false); setShowAllSessions(false); }}
                            className="w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                          >
                            {t}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {visibleSessions.map((s) => {
                const scoreColor =
                  s.score_percent >= 75 ? 'text-secondary-500' : s.score_percent >= 40 ? 'text-warning' : 'text-error';
                return (
                  <Link
                    key={s.id}
                    href={s.session_type === 'exam' ? `/exam/results/${s.id}` : `/quiz/results/${s.id}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-md transition-colors hover:bg-neutral-50 sm:p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-700">
                        {s.topic_title}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {s.question_count} questions · {s.session_type === 'exam' ? 'Examen' : 'Entraînement'} · {formatDate(s.completed_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-bold ${scoreColor}`}>
                      {s.score_percent}%
                    </span>
                  </Link>
                );
              })}
            </div>
            {hasMore && !showAllSessions && (
              <button
                type="button"
                onClick={() => setShowAllSessions(true)}
                className="mt-2 min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary-50"
              >
                Voir tout ({filteredSessions.length})
              </button>
            )}
            {showAllSessions && hasMore && (
              <button
                type="button"
                onClick={() => setShowAllSessions(false)}
                className="mt-2 min-h-[44px] w-full rounded-lg py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
              >
                Réduire
              </button>
            )}
          </section>
        );
      })()}
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
