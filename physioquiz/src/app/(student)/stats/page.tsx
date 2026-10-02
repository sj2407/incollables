'use client';

import { Info as InfoIcon, X } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MetricCard, ChartIcon, SessionsIcon, TimerIcon, FlaskIcon } from '@/components/stats/MetricCards';
import { WeakQuestionsSection, type WeakQuestion } from '@/components/stats/WeakQuestions';
import type { HeatmapNode } from '@/components/stats/Heatmap';
import { TopicDetailPanel, fetchTopicDetailStats, type TopicDetailStats } from '@/components/stats/Heatmap';
import type { BrierWeekPoint, BrierTopicPoint, TopicCalibrationDetail } from '@/components/stats/CalibrationChart';
import { CalibrationTopicDetailPanel } from '@/components/stats/CalibrationChart';
import ScoreCircle from '@/components/ui/ScoreCircle';
import StaggerList from '@/components/ui/StaggerList';
import TiltCard from '@/components/ui/TiltCard';
import PillToggle from '@/components/ui/PillToggle';

const ProgressChart = dynamic(() => import('@/components/stats/ProgressChart'), { ssr: false });
const ActivityCalendar = dynamic(() => import('@/components/stats/ActivityCalendar'), { ssr: false });
const CalibrationChart = dynamic(() => import('@/components/stats/CalibrationChart'), { ssr: false });
const Heatmap = dynamic(() => import('@/components/stats/Heatmap'), { ssr: false });

/** Shared height for progression section (chart + activity calendar) */
const PROGRESSION_HEIGHT = 220;

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

interface FalseCertainty {
  question_id: string;
  question_text: string;
  question_number: number | null;
  topic_title: string;
  score_percent: number;
}

interface CalibrationData {
  levels: { confidence_level: number; total_answers: number; correct_answers: number; success_rate: number }[] | null;
  false_certainties: FalseCertainty[] | null;
  confidence_fill_rate_alltime: number;
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
  const [prevWeekStats, setPrevWeekStats] = useState<{ avg_score: number | null; total_sessions: number; total_study_minutes: number; partial_count: number } | null>(null);
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [calibrationAnswers, setCalibrationAnswers] = useState<CalibrationAnswer[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapNode[]>([]);
  const [weakQuestions, setWeakQuestions] = useState<WeakQuestion[]>([]);
  const [sessions, setSessions] = useState<SessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [progressView, setProgressView] = useState<'chart' | 'calendar'>('chart');
  const [calibrationView, setCalibrationView] = useState<'scatter' | 'evolution' | 'topics'>('scatter');
  const [brierWeekly, setBrierWeekly] = useState<BrierWeekPoint[]>([]);
  const [brierByTopic, setBrierByTopic] = useState<BrierTopicPoint[]>([]);
  const [fcTimeFilter, setFcTimeFilter] = useState<'7' | '30' | 'all'>('30');
  const [falseCertitudes, setFalseCertitudes] = useState<FalseCertainty[]>([]);
  const [confidenceFillRateAllTime, setConfidenceFillRateAllTime] = useState(0);
  const [calSelectedTopic, setCalSelectedTopic] = useState<BrierTopicPoint | null>(null);
  const [calTopicDetails, setCalTopicDetails] = useState<TopicCalibrationDetail[] | null>(null);
  const [calTopicLoading, setCalTopicLoading] = useState(false);

  // Page-level type filter
  const [filterType, setFilterType] = useState<string>('all');

  // Heatmap detail panel (rendered outside TiltCard)
  const [heatmapSelectedNode, setHeatmapSelectedNode] = useState<HeatmapNode | null>(null);
  const [heatmapDetailStats, setHeatmapDetailStats] = useState<TopicDetailStats | null>(null);
  const [heatmapDetailLoading, setHeatmapDetailLoading] = useState(false);

  const handleHeatmapNodeSelect = useCallback(async (node: HeatmapNode | null) => {
    if (!node) {
      setHeatmapSelectedNode(null);
      setHeatmapDetailStats(null);
      return;
    }
    setHeatmapSelectedNode(node);
    setHeatmapDetailLoading(true);
    setHeatmapDetailStats(null);
    const stats = await fetchTopicDetailStats(node.topic_id);
    setHeatmapDetailStats(stats);
    setHeatmapDetailLoading(false);
  }, []);

  const handleCalTopicSelect = useCallback(async (topic: BrierTopicPoint | null) => {
    if (!topic) {
      setCalSelectedTopic(null);
      setCalTopicDetails(null);
      return;
    }
    setCalSelectedTopic(topic);
    setCalTopicLoading(true);
    setCalTopicDetails(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCalTopicLoading(false); return; }
    const rpcType = filterType === 'all' ? null : filterType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = { p_user_id: user.id, p_topic_id: topic.topic_id };
    if (rpcType) params.p_session_type = rpcType;
    const { data } = await supabase.rpc('get_topic_calibration_detail', params);
    setCalTopicDetails(data as TopicCalibrationDetail[] | null);
    setCalTopicLoading(false);
  }, [filterType]);

  // Session history controls
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [historyTopicFilter, setHistoryTopicFilter] = useState<string>('');
  const [historySearchOpen, setHistorySearchOpen] = useState(false);

  const fetchData = useCallback(async (sessionType: string) => {
    setLoading(true);
    setError(null);
    setLoadWarning(null);
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

    const results = await Promise.all([
      supabase.rpc('get_dashboard_stats', rpcParams({ p_user_id: user.id })),
      supabase.rpc('get_dashboard_stats_prev_week', rpcParams({ p_user_id: user.id })),
      progressQuery,
      supabase.rpc('get_calibration_data', rpcParams({ p_user_id: user.id, p_fc_days: fcTimeFilter === 'all' ? null : parseInt(fcTimeFilter) })),
      supabase.rpc('get_topic_mastery_detailed', rpcParams({ p_user_id: user.id })),
      supabase.rpc('get_weak_questions', rpcParams({ p_user_id: user.id })),
      sessionQuery,
      calibAnswersQuery,
      supabase.rpc('get_brier_score_by_week', rpcParams({ p_user_id: user.id })),
      supabase.rpc('get_brier_score_by_topic', rpcParams({ p_user_id: user.id })),
    ]);

    const [statsResult, prevWeekResult, progressResult, calibrationResult, masteryResult, weakResult, sessionResult, calibAnswersResult, brierWeeklyResult, brierByTopicResult] = results;

    if (results.some((result) => result.error)) {
      setLoadWarning('Certaines données n’ont pas pu être chargées. Les résultats affichés peuvent être incomplets ou ne pas être à jour.');
    }

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

    // Previous week stats (for WoW trends)
    if (prevWeekResult.data && !prevWeekResult.error) {
      const pw = Array.isArray(prevWeekResult.data) ? prevWeekResult.data[0] : prevWeekResult.data;
      if (pw) {
        setPrevWeekStats({
          avg_score: pw.avg_score != null ? Number(pw.avg_score) : null,
          total_sessions: Number(pw.total_sessions ?? 0),
          total_study_minutes: Math.round(Number(pw.total_study_time_seconds ?? 0) / 60),
          partial_count: Number(pw.partial_answer_count ?? 0),
        });
      } else {
        setPrevWeekStats(null);
      }
    }

    // Progress — group by day with weighted average by question count
    if (progressResult.data && !progressResult.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = progressResult.data as any[];
      const dailyMap = new Map<string, { totalWeightedScore: number; totalQuestions: number; isoDate: string }>();
      for (const d of raw) {
        const day = new Date(d.completed_at).toISOString().slice(0, 10);
        const qCount = Number(d.question_count ?? 0);
        const score = Number(d.score_percent ?? 0);
        const existing = dailyMap.get(day) ?? { totalWeightedScore: 0, totalQuestions: 0, isoDate: d.completed_at };
        existing.totalWeightedScore += score * qCount;
        existing.totalQuestions += qCount;
        dailyMap.set(day, existing);
      }
      const points: ProgressPoint[] = Array.from(dailyMap.entries()).map(([, v]) => ({
        date: v.isoDate,
        score: v.totalQuestions > 0 ? Math.round((v.totalWeightedScore / v.totalQuestions) * 10) / 10 : 0,
        question_count: v.totalQuestions,
      }));
      setProgress(points);
    }

    // Calibration (aggregated for false certainties + fill rate)
    if (calibrationResult.data && !calibrationResult.error) {
      const calData = calibrationResult.data as CalibrationData;
      setCalibration(calData);
      setConfidenceFillRateAllTime(calData.confidence_fill_rate_alltime ?? 0);
      setFalseCertitudes(calData.false_certainties ?? []);
    }

    // Calibration individual answers
    if (calibAnswersResult.data && !calibAnswersResult.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCalibrationAnswers((calibAnswersResult.data as any[]).map((a) => ({
        confidence: Number(a.confidence),
        score_percent: Number(a.score_percent),
      })));
    }

    // Brier score data
    if (brierWeeklyResult.data && !brierWeeklyResult.error) {
      setBrierWeekly(brierWeeklyResult.data as BrierWeekPoint[]);
    }
    if (brierByTopicResult.data && !brierByTopicResult.error) {
      setBrierByTopic(brierByTopicResult.data as BrierTopicPoint[]);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (weakResult.data as any[]).map((q) => ({
          question_id: q.question_id,
          question_text: q.question_text,
          question_number: q.question_number,
          topic_title: q.topic_title,
          topic_id: q.topic_id,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fcTimeFilter]);

  // Re-fetch everything when filter or FC time filter changes
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
            className="min-h-[44px] glass-card-inner px-3 py-1.5 text-base sm:text-sm text-neutral-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          className="mt-2 min-h-[44px] rounded-2xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const avgScore = stats?.avg_score_this_week;
  const studyHours = stats ? Math.round(stats.total_study_minutes / 60) : 0;
  const studyMinutes = stats ? stats.total_study_minutes % 60 : 0;

  // Week-over-week trends from server-side prev_week RPC
  const trends = (() => {
    if (!stats || !prevWeekStats || prevWeekStats.total_sessions === 0) {
      // No last week data — show "pas de données" on all cards
      return { scoreDelta: null, sessionsDelta: null, timeDelta: null, partialDelta: null };
    }

    const pw = prevWeekStats;
    const scoreDelta =
      stats.avg_score_this_week !== null && pw.avg_score !== null
        ? Math.round(stats.avg_score_this_week - pw.avg_score)
        : null;

    const sessionsDelta = pw.total_sessions > 0
      ? Math.round(((stats.session_count_this_week - pw.total_sessions) / pw.total_sessions) * 100)
      : null;

    const timeDelta = pw.total_study_minutes > 0
      ? Math.round(((stats.total_study_minutes - pw.total_study_minutes) / pw.total_study_minutes) * 100)
      : null;

    const partialDelta = pw.partial_count > 0
      ? Math.round(((stats.partial_count - pw.partial_count) / pw.partial_count) * 100)
      : null;

    return { scoreDelta, sessionsDelta, timeDelta, partialDelta };
  })();

  const hasPrevWeekData = prevWeekStats !== null && prevWeekStats.total_sessions > 0;

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
          className="h-8 glass-card-inner px-2 py-1 text-xs text-neutral-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">Tous les types</option>
          <option value="short">Entraînement</option>
          <option value="exam">Examen</option>
        </select>
      </div>

      {loadWarning && (
        <div className="mt-4">
          <p role="alert" className="text-sm text-error">{loadWarning}</p>
          <button
            type="button"
            onClick={() => fetchData(filterType)}
            className="mt-2 min-h-[44px] rounded-2xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary-50"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* 1. Metric cards — 2×2 grid */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Score hebdo"
          value={avgScore != null ? `${Math.round(avgScore)}%` : '—'}
          numericValue={avgScore != null ? Math.round(avgScore) : undefined}
          numericSuffix="%"
          icon={<ChartIcon color="#194ce6" />}
          borderColor="#194ce6"
          tooltip="Score moyen de vos sessions des 7 derniers jours."
          trend={hasPrevWeekData && trends.scoreDelta !== null ? { value: trends.scoreDelta, label: 'vs sem. dernière' } : { value: 0, label: hasPrevWeekData ? 'stable' : 'pas de données sem. précédente' }}
        />
        <MetricCard
          label="Sessions"
          value={String(stats?.session_count_this_week ?? 0)}
          numericValue={stats?.session_count_this_week ?? 0}
          icon={<SessionsIcon color="#0ea5e9" />}
          borderColor="#0ea5e9"
          tooltip="Nombre de sessions terminées dans les 7 derniers jours."
          trend={hasPrevWeekData && trends.sessionsDelta !== null ? { value: trends.sessionsDelta, label: 'vs sem. dernière' } : { value: 0, label: hasPrevWeekData ? 'stable' : 'pas de données sem. précédente' }}
        />
        <MetricCard
          label="Temps d'étude"
          value={studyHours > 0 ? `${studyHours}h${studyMinutes > 0 ? `${studyMinutes}` : ''}` : `${studyMinutes}min`}
          icon={<TimerIcon color="#B45309" />}
          borderColor="#B45309"
          tooltip="Temps total d'étude (hors pauses) des 7 derniers jours."
          trend={hasPrevWeekData && trends.timeDelta !== null ? { value: trends.timeDelta, label: 'vs sem. dernière' } : { value: 0, label: hasPrevWeekData ? 'stable' : 'pas de données sem. précédente' }}
        />
        <MetricCard
          label="Rép. partielles"
          value={String(stats?.partial_count ?? 0)}
          numericValue={stats?.partial_count ?? 0}
          icon={<FlaskIcon color="#6366f1" />}
          borderColor="#6366f1"
          tooltip="Nombre de réponses partiellement correctes (certains bons choix cochés, mais pas tous) des 7 derniers jours. Diffère des « Questions à revoir » qui montre toutes les questions avec un score moyen < 100 % sur l'ensemble de vos tentatives."
          trend={hasPrevWeekData && trends.partialDelta !== null ? { value: trends.partialDelta, label: 'vs sem. dernière' } : { value: 0, label: hasPrevWeekData ? 'stable' : 'pas de données sem. précédente' }}
        />
      </div>

      {/* 2. Progress chart / Activity calendar */}
      <section className="mt-6" aria-labelledby="scores-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="scores-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
            Progression
          </h2>
          <PillToggle
            options={[
              { key: 'chart', label: 'Courbe' },
              { key: 'calendar', label: 'Activité' },
            ]}
            active={progressView}
            onChange={(key) => setProgressView(key as 'chart' | 'calendar')}
          />
        </div>
        <TiltCard className="glass-card-inner p-4 sm:p-6" tiltDeg={1.5} gentle>
          <div className={progressView === 'chart' ? '' : 'hidden'}>
            <ProgressChart data={progress} height={PROGRESSION_HEIGHT} />
          </div>
          <div className={progressView === 'calendar' ? '' : 'hidden'}>
            <ActivityCalendar
              sessions={progress.map((p) => ({
                completed_at: p.date,
                question_count: p.question_count ?? 0,
                score_percent: p.score,
              }))}
              height={PROGRESSION_HEIGHT}
            />
          </div>
        </TiltCard>
      </section>

      {/* 3. Heatmap (attempted topics only) */}
      {heatmapData.length > 0 && (
        <section className="mt-6" aria-labelledby="heatmap-heading">
          <h2 id="heatmap-heading" className="mb-3 text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
            Carte des connaissances
          </h2>
          <TiltCard className="glass-card-inner p-4 sm:p-6" tiltDeg={1.5} gentle>
            <Heatmap data={heatmapData} onNodeSelect={handleHeatmapNodeSelect} />
          </TiltCard>
          {heatmapSelectedNode && (
            <TopicDetailPanel
              node={heatmapSelectedNode}
              stats={heatmapDetailStats}
              loading={heatmapDetailLoading}
              onClose={() => { setHeatmapSelectedNode(null); setHeatmapDetailStats(null); }}
            />
          )}
        </section>
      )}

      {/* 4. Calibration */}
      <section className="mt-6" aria-labelledby="calibration-heading">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 id="calibration-heading" className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
              Calibration
            </h2>
            <p className="text-xs text-neutral-500">
              Votre taux de réussite réel vs votre confiance déclarée
              <span className="ml-1 inline-flex align-middle text-neutral-400" title="Chaque point = une réponse individuelle (non moyennée par question)"><InfoIcon /></span>
            </p>
          </div>
          <PillToggle
            options={[
              { key: 'scatter', label: 'Points' },
              { key: 'evolution', label: 'Courbe' },
              { key: 'topics', label: 'Thèmes' },
            ]}
            active={calibrationView}
            onChange={(key) => {
              setCalibrationView(key as 'scatter' | 'evolution' | 'topics');
              if (key !== 'topics') { setCalSelectedTopic(null); setCalTopicDetails(null); }
            }}
          />
        </div>
        <TiltCard className="glass-card-inner p-4 sm:p-6" tiltDeg={1.5} gentle>
          <CalibrationChart
            data={calibration ?? { levels: null, false_certainties: null, confidence_fill_rate_alltime: 0 }}
            answers={calibrationAnswers}
            confidenceFillRate={stats?.confidence_fill_rate ?? 0}
            confidenceFillRateAllTime={confidenceFillRateAllTime}
            view={calibrationView}
            brierWeekly={brierWeekly}
            brierByTopic={brierByTopic}
            onTopicSelect={handleCalTopicSelect}
          />
        </TiltCard>
        {calSelectedTopic && (
          <CalibrationTopicDetailPanel
            topic={calSelectedTopic}
            details={calTopicDetails}
            loading={calTopicLoading}
            onClose={() => { setCalSelectedTopic(null); setCalTopicDetails(null); }}
          />
        )}
      </section>

      {/* 4b. False certainties */}
      {falseCertitudes.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]">
                Fausses certitudes ({falseCertitudes.length})
              </h2>
              <p className="mt-1 text-xs text-neutral-400">
                Questions où vous étiez sûr mais la réponse était fausse
              </p>
            </div>
            <PillToggle
              options={[
                { key: '7', label: '7j' },
                { key: '30', label: '30j' },
                { key: 'all', label: 'Tout' },
              ]}
              active={fcTimeFilter}
              onChange={(key) => setFcTimeFilter(key as '7' | '30' | 'all')}
            />
          </div>
          <div className="relative">
            <div className="max-h-[230px] overflow-y-auto rounded-xl">
              <StaggerList className="flex flex-col gap-2 p-1" staggerDelay={0.08} duration={0.4}>
                {falseCertitudes.map((fc) => (
                  <div
                    key={fc.question_id}
                    className="flex items-center gap-3 glass-card-scroll border-l-4 border-l-warning p-2.5"
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
                    <div className="shrink-0">
                      <ScoreCircle score={fc.score_percent} size={40} strokeWidth={2.5} fontSize={11} />
                    </div>
                  </div>
                ))}
              </StaggerList>
            </div>
          </div>
        </section>
      )}

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
                    className="h-8 w-[140px] glass-card-inner px-2 py-1 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {historyTopicFilter && (
                    <button
                      type="button"
                      onClick={() => { setHistoryTopicFilter(''); setShowAllSessions(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                      aria-label="Effacer le filtre"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {historySearchOpen && historyTopicFilter && matchingTopics.length > 0 && (
                    <ul className="absolute right-0 top-full z-10 mt-1 max-h-40 w-[220px] overflow-y-auto glass-card-inner py-1">
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
            <StaggerList className="mt-3 flex flex-col gap-2">
              {visibleSessions.map((s) => (
                <Link
                  key={s.id}
                  href={s.session_type === 'exam' ? `/exam/results/${s.id}` : `/quiz/results/${s.id}`}
                  className="flex items-center justify-between glass-card-inner border-l-4 border-l-primary p-3 transition-colors hover:bg-white/50 sm:p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-700">
                      {s.topic_title}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {s.question_count} questions · {s.session_type === 'exam' ? 'Examen' : 'Entraînement'} · {formatDate(s.completed_at)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <ScoreCircle score={s.score_percent} size={40} strokeWidth={2.5} fontSize={11} />
                  </div>
                </Link>
              ))}
            </StaggerList>
            {hasMore && !showAllSessions && (
              <button
                type="button"
                onClick={() => setShowAllSessions(true)}
                className="mt-2 min-h-[44px] w-full rounded-2xl glass-card-inner py-2 text-sm font-medium text-primary transition-colors hover:bg-white/50"
              >
                Voir tout ({filteredSessions.length})
              </button>
            )}
            {showAllSessions && hasMore && (
              <button
                type="button"
                onClick={() => setShowAllSessions(false)}
                className="mt-2 min-h-[44px] w-full rounded-2xl py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
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
