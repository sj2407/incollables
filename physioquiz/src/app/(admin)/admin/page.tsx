'use client';

import { User, BookOpen, CheckCircle } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { MetricCard, SessionsIcon, FlaskIcon, TimerIcon } from '@/components/stats/MetricCards';
import { QualityAlerts, type QualityAlert } from '@/components/admin/QualityAlerts';
import dynamic from 'next/dynamic';

const AdminCharts = dynamic(() => import('@/components/admin/AdminStatsCharts'), { ssr: false });

interface DashboardStats {
  total_questions: number;
  total_active_questions: number;
  total_chapters: number;
  registered_students: number;
  sessions_this_week: number;
  sessions_prev_week: number;
}

interface GlobalStats {
  registered_users: number;
  active_today: number;
  active_this_week: number;
  active_this_month: number;
  avg_session_duration_seconds: number;
  total_sessions: number;
  avg_score: number;
}

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
  coverage_percent: number;
  total_questions: number;
  attempted_questions: number;
}

function UsersIcon({ color }: { color: string }) {
  return <User size={16} color={color} weight="duotone" />;
}

function BookIcon({ color }: { color: string }) {
  return <BookOpen size={16} color={color} weight="duotone" />;
}

function ScoreIcon({ color }: { color: string }) {
  return <CheckCircle size={16} color={color} weight="duotone" />;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [alerts, setAlerts] = useState<QualityAlert[]>([]);
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [chapterScores, setChapterScores] = useState<ChapterScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const [statsResult, alertsResult, globalResult, dailyResult, chapterResult] = await Promise.all([
      supabase.rpc('get_admin_dashboard_stats'),
      supabase.rpc('get_admin_quality_alerts'),
      supabase.rpc('get_admin_global_stats'),
      supabase.rpc('get_admin_sessions_per_day', { p_days: 30 }),
      supabase.rpc('get_admin_score_by_chapter'),
    ]);

    // Collect errors but don't block — show partial results
    const errors: string[] = [];

    if (statsResult.error) {
      errors.push(statsResult.error.message);
    } else if (statsResult.data) {
      const row = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data;
      setStats({
        total_questions: Number(row.total_questions),
        total_active_questions: Number(row.total_active_questions),
        total_chapters: Number(row.total_chapters),
        registered_students: Number(row.registered_students),
        sessions_this_week: Number(row.sessions_this_week),
        sessions_prev_week: Number(row.sessions_prev_week),
      });
    }

    if (globalResult.error) {
      errors.push(globalResult.error.message);
    } else if (globalResult.data) {
      const row = Array.isArray(globalResult.data) ? globalResult.data[0] : globalResult.data;
      setGlobalStats({
        registered_users: Number(row.registered_users),
        active_today: Number(row.active_today),
        active_this_week: Number(row.active_this_week),
        active_this_month: Number(row.active_this_month),
        avg_session_duration_seconds: Number(row.avg_session_duration_seconds),
        total_sessions: Number(row.total_sessions),
        avg_score: Number(row.avg_score),
      });
    }

    if (alertsResult.error) {
      errors.push(alertsResult.error.message);
    } else if (alertsResult.data) {
      setAlerts((alertsResult.data as Record<string, unknown>[]).map((a) => ({
        question_id: a.question_id as string,
        question_number: a.question_number as number | null,
        question_text: a.question_text as string,
        topic_title: a.topic_title as string,
        alert_type: a.alert_type as string,
        error_rate: Number(a.error_rate),
        attempt_count: Number(a.attempt_count),
      })));
    }

    if (dailyResult.error) {
      errors.push(dailyResult.error.message);
    } else if (dailyResult.data) {
      setDailyData((dailyResult.data as Record<string, unknown>[]).map((d) => ({
        day: d.day as string,
        session_count: Number(d.session_count),
        avg_score: Number(d.avg_score),
      })));
    }

    if (chapterResult.error) {
      errors.push(chapterResult.error.message);
    } else if (chapterResult.data) {
      setChapterScores((chapterResult.data as Record<string, unknown>[]).map((c) => ({
        topic_id: c.topic_id as string,
        topic_title: c.topic_title as string,
        avg_score: Number(c.avg_score),
        session_count: Number(c.session_count),
        coverage_percent: Number(c.coverage_percent ?? 0),
        total_questions: Number(c.total_questions ?? 0),
        attempted_questions: Number(c.attempted_questions ?? 0),
      })));
    }

    if (errors.length > 0) setError(errors.join(' | '));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">Dashboard</h1>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 animate-pulse glass-card-inner" />
          ))}
        </div>
      </div>
    );
  }

  // Error is shown as a banner below, not as a full-page block

  const sessionsTrend = stats && stats.sessions_prev_week > 0
    ? Math.round(((stats.sessions_this_week - stats.sessions_prev_week) / stats.sessions_prev_week) * 100)
    : null;

  const durationMin = globalStats ? Math.round(globalStats.avg_session_duration_seconds / 60) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Vue d&apos;ensemble de la plateforme</p>

      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-error/20 bg-red-50 px-4 py-2">
          <p className="flex-1 text-sm text-error">{error}</p>
          <button type="button" onClick={fetchData} className="min-h-[36px] text-sm font-medium text-primary hover:text-primary-700">
            Réessayer
          </button>
        </div>
      )}

      {/* Metric cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          label="Questions"
          value={`${stats?.total_active_questions ?? 0} / ${stats?.total_questions ?? 0}`}
          icon={<FlaskIcon color="#194ce6" />}
          borderColor="#194ce6"
          tooltip="Questions actives / total"
        />
        <MetricCard
          label="Chapitres"
          value={String(stats?.total_chapters ?? 0)}
          icon={<BookIcon color="#10B981" />}
          borderColor="#10B981"
          tooltip="Nombre de chapitres actifs"
        />
        <MetricCard
          label="Étudiants"
          value={String(stats?.registered_students ?? 0)}
          icon={<UsersIcon color="#D97706" />}
          borderColor="#D97706"
          tooltip={`DAU: ${globalStats?.active_today ?? 0} · WAU: ${globalStats?.active_this_week ?? 0} · MAU: ${globalStats?.active_this_month ?? 0}`}
        />
        <MetricCard
          label="Sessions / sem."
          value={String(stats?.sessions_this_week ?? 0)}
          icon={<SessionsIcon color="#0ea5e9" />}
          borderColor="#0ea5e9"
          tooltip="Sessions terminées cette semaine"
          trend={sessionsTrend !== null ? { value: sessionsTrend, label: 'vs sem. précédente' } : undefined}
        />
        <MetricCard
          label="Score moyen"
          value={`${globalStats?.avg_score ?? 0}%`}
          icon={<ScoreIcon color="#8B5CF6" />}
          borderColor="#8B5CF6"
          tooltip={`Score moyen global · ${globalStats?.total_sessions ?? 0} sessions au total`}
        />
        <MetricCard
          label="Durée moy."
          value={`${durationMin} min`}
          icon={<TimerIcon color="#F59E0B" />}
          borderColor="#F59E0B"
          tooltip="Durée moyenne par session (hors pauses)"
        />
      </div>

      {/* Quality alerts */}
      <section className="mt-8">
        <h2 className="mb-1 text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
          Alertes qualité
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Questions sans propositions ou avec un taux d&apos;erreur &gt; 80%
        </p>
        <QualityAlerts alerts={alerts} />
      </section>

      {/* Charts */}
      <AdminCharts dailyData={dailyData} chapterScores={chapterScores} />
    </div>
  );
}
