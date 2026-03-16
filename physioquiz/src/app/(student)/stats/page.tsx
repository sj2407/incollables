'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MetricCard } from '@/components/stats/MetricCards';
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
  const [heatmapData, setHeatmapData] = useState<HeatmapNode[]>([]);
  const [weakQuestions, setWeakQuestions] = useState<WeakQuestion[]>([]);
  const [sessions, setSessions] = useState<SessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Page-level type filter
  const [filterType, setFilterType] = useState<string>('all');

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcParams = (base: Record<string, any>) =>
      rpcType ? { ...base, p_session_type: rpcType } : base;

    const [statsResult, progressResult, calibrationResult, masteryResult, weakResult, sessionResult] =
      await Promise.all([
        supabase.rpc('get_dashboard_stats', rpcParams({ p_user_id: user.id })),
        progressQuery,
        supabase.rpc('get_calibration_data', rpcParams({ p_user_id: user.id })),
        supabase.rpc('get_topic_mastery_detailed', rpcParams({ p_user_id: user.id })),
        supabase.rpc('get_weak_questions', rpcParams({ p_user_id: user.id })),
        sessionQuery,
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

    // Calibration
    if (calibrationResult.data && !calibrationResult.error) {
      setCalibration(calibrationResult.data as CalibrationData);
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
            className="min-h-[44px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm"
          >
            <option value="all">Tous les types</option>
            <option value="short">Entraînement</option>
            <option value="exam">Examen</option>
          </select>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
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
          className="mt-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-primary-500 hover:bg-primary-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const avgScore = stats?.avg_score_this_week;
  const studyHours = stats ? Math.round(stats.total_study_minutes / 60) : 0;
  const studyMinutes = stats ? stats.total_study_minutes % 60 : 0;

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
          className="min-h-[44px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm"
        >
          <option value="all">Tous les types</option>
          <option value="short">Entraînement</option>
          <option value="exam">Examen</option>
        </select>
      </div>

      {/* 1. Metric cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Score cette semaine"
          value={avgScore != null ? `${Math.round(avgScore)}%` : '—'}
          color={avgScore != null && avgScore >= 75 ? 'text-secondary-500' : avgScore != null && avgScore >= 40 ? 'text-warning' : 'text-error'}
        />
        <MetricCard
          label="Sessions"
          value={String(stats?.session_count_this_week ?? 0)}
          color="text-primary-500"
        />
        <MetricCard
          label="Temps d'étude"
          value={studyHours > 0 ? `${studyHours}h${studyMinutes > 0 ? `${studyMinutes}` : ''}` : `${studyMinutes}min`}
          color="text-neutral-700"
        />
        <MetricCard
          label="Partielles"
          value={String(stats?.partial_count ?? 0)}
          color="text-warning"
        />
      </div>

      {/* 2. Progress chart */}
      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6" aria-labelledby="scores-heading">
        <h2 id="scores-heading" className="text-sm font-semibold text-neutral-700">
          Progression
        </h2>
        <div className="mt-3">
          <ProgressChart data={progress} height={260} />
        </div>
      </section>

      {/* 3. Heatmap (attempted topics only) */}
      {heatmapData.length > 0 && (
        <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6" aria-labelledby="heatmap-heading">
          <h2 id="heatmap-heading" className="text-sm font-semibold text-neutral-700">
            Carte des connaissances
          </h2>
          <div className="mt-3">
            <Heatmap data={heatmapData} />
          </div>
        </section>
      )}

      {/* 4. Calibration */}
      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-md sm:p-6" aria-labelledby="calibration-heading">
        <h2 id="calibration-heading" className="text-sm font-semibold text-neutral-700">
          Calibration
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Votre taux de réussite réel vs votre confiance déclarée
        </p>
        <div className="mt-3">
          <CalibrationChart
            data={calibration ?? { levels: null, false_certainties: null }}
            confidenceFillRate={stats?.confidence_fill_rate ?? 0}
          />
        </div>
      </section>

      {/* 5. Weak questions */}
      {weakQuestions.length > 0 && (
        <WeakQuestionsSection questions={weakQuestions} />
      )}

      {/* 6. Session history */}
      {sessions.length > 0 && (
        <section className="mt-6" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
            Historique des sessions
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {sessions.map((s) => {
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
        </section>
      )}
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
