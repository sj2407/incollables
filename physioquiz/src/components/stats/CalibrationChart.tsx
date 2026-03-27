'use client';

import { memo, useMemo } from 'react';
import { Info as InfoIcon } from '@phosphor-icons/react';
import {
  ResponsiveContainer,
  ScatterChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  Cell,
  ReferenceLine,
  ComposedChart,
  Area,
  Treemap,
} from 'recharts';

// ---------------------------------------------------------------------------
// Exported types (shared with page.tsx)
// ---------------------------------------------------------------------------

export interface BrierWeekPoint {
  week_start: string;
  calibration_score: number;
  answer_count: number;
}

export interface BrierTopicPoint {
  topic_id: string;
  topic_title: string;
  calibration_score: number;
  answer_count: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CalibrationData {
  levels: unknown;
  false_certainties: unknown;
  confidence_fill_rate_alltime?: number;
}

interface CalibrationAnswer {
  confidence: number;
  score_percent: number;
}

interface CalibrationChartProps {
  data: CalibrationData;
  answers: CalibrationAnswer[];
  confidenceFillRate: number;
  confidenceFillRateAllTime: number;
  compact?: boolean;
  view: 'scatter' | 'evolution' | 'topics';
  brierWeekly: BrierWeekPoint[];
  brierByTopic: BrierTopicPoint[];
  onTopicSelect?: (topic: BrierTopicPoint | null) => void;
}

// Exported types for detail panel
export interface TopicCalibrationDetail {
  confidence_level: number;
  total_answers: number;
  correct_answers: number;
  success_rate: number;
  brier_score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIDENCE_LABELS: Record<number, string> = {
  0: 'Je devine',
  0.5: 'Hésitant',
  1: 'Sûr',
};

const CONFIDENCE_COLORS: Record<number, string> = {
  0: '#B45309',
  0.5: '#194ce6',
  1: '#10B981',
};

const CONFIDENCE_X: Record<number, number> = {
  0: 1,
  0.5: 2,
  1: 3,
};

const EXPECTED: Record<number, number> = { 0: 33, 0.5: 50, 1: 90 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function getCalibrationColor(score: number): string {
  if (score >= 85) return '#10B981';
  if (score >= 75) return '#0ea5e9';
  if (score >= 60) return '#D97706';
  if (score >= 40) return '#DC2626';
  return '#B91C1C';
}

// Expected accuracy per confidence level (for reference lines + diagnosis)
const REFERENCE_LINES = [
  { y: 33, label: 'Je devine attendu' },
  { y: 50, label: 'Hésitant attendu' },
  { y: 90, label: 'Sûr attendu' },
];

// ---------------------------------------------------------------------------
// Treemap cell (follows Heatmap.tsx pattern)
// ---------------------------------------------------------------------------

function CalibrationTreemapCell(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  calibration_score: number;
  topic_id: string;
  depth: number;
  index: number;
  onCellClick?: (topicId: string, name: string, score: number) => void;
}) {
  const { x, y, width, height, name, calibration_score, depth } = props;

  const gap = 4;
  const cx = x + gap;
  const cy = y + gap;
  const cw = width - gap * 2;
  const ch = height - gap * 2;

  if (depth !== 1 || cw < 4 || ch < 4) return null;

  const color = getCalibrationColor(calibration_score);
  const showText = cw > 40 && ch > 35;
  const needsDarkText = calibration_score >= 60 && calibration_score < 85;
  const textColor = needsDarkText ? '#1f2937' : '#fff';
  const subTextColor = needsDarkText ? 'rgba(31,41,55,0.75)' : 'rgba(255,255,255,0.85)';
  const scoreText = `${Math.round(calibration_score)}%`;
  const tooltipText = `${name}\nCalibration : ${scoreText}`;
  const gradId = `cal-grad-${props.index}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <rect
        x={cx} y={cy} width={cw} height={ch} rx={12} fill={color} stroke="none"
        style={{ cursor: 'pointer' }}
        onClick={() => props.onCellClick?.(props.topic_id, name, calibration_score)}
      >
        <title>{tooltipText}</title>
      </rect>
      <rect x={cx} y={cy} width={cw} height={ch} rx={12} fill={`url(#${gradId})`} stroke="none" style={{ pointerEvents: 'none' }} />
      {showText && (
        <foreignObject x={cx + 8} y={cy + 6} width={cw - 16} height={ch - 12} style={{ pointerEvents: 'none' }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', padding: '2px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: textColor, wordBreak: 'break-word', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {name}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: subTextColor, marginTop: 3 }}>
              {scoreText}
            </span>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function CalibrationChart({
  data,
  answers,
  confidenceFillRateAllTime,
  compact = false,
  view,
  brierWeekly,
  brierByTopic,
  onTopicSelect,
}: CalibrationChartProps) {
  // Build scatter data from individual answers with jitter on X
  const scatterData = useMemo(() => {
    return answers
      .filter((a) => a.confidence in CONFIDENCE_X)
      .map((a, i) => {
        const baseX = CONFIDENCE_X[a.confidence];
        const jitter = (seededRandom(i) - 0.5) * 0.4;
        return {
          x: baseX + jitter,
          y: a.score_percent,
          confidence: a.confidence,
          label: CONFIDENCE_LABELS[a.confidence],
        };
      });
  }, [answers]);

  // Compute averages per confidence level
  const averages = useMemo(() => {
    const groups: Record<number, { total: number; count: number }> = {};
    for (const a of answers) {
      if (!(a.confidence in CONFIDENCE_LABELS)) continue;
      if (!groups[a.confidence]) groups[a.confidence] = { total: 0, count: 0 };
      groups[a.confidence].total += a.score_percent;
      groups[a.confidence].count += 1;
    }
    return [0, 0.5, 1].map((conf) => ({
      label: CONFIDENCE_LABELS[conf],
      avg: groups[conf] ? Math.round(groups[conf].total / groups[conf].count) : 0,
      count: groups[conf]?.count ?? 0,
      confidence: conf,
    }));
  }, [answers]);

  // Diagnosis based on averages vs expected
  const diagnosis = useMemo(() => {
    let overCount = 0, underCount = 0, counted = 0;
    for (const level of averages) {
      if (level.count < 5) continue;
      const gap = level.avg - EXPECTED[level.confidence];
      if (gap < -10) overCount++;
      if (gap > 10) underCount++;
      counted++;
    }
    if (counted === 0) return null;
    if (overCount > underCount) return { label: 'Surconfiant', color: '#B45309' };
    if (underCount > overCount) return { label: 'Sous-confiant', color: '#0ea5e9' };
    return { label: 'Bien calibré', color: '#10B981' };
  }, [averages]);

  // Evolution chart data
  const evolutionData = useMemo(() =>
    brierWeekly.map((d) => ({
      week: new Date(d.week_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      calibration_score: d.calibration_score,
      answer_count: d.answer_count,
    }))
  , [brierWeekly]);

  // Treemap data
  const treemapData = useMemo(() =>
    brierByTopic.map((t) => ({
      name: t.topic_title,
      topic_id: t.topic_id,
      size: Math.log2(Math.max(t.answer_count, 1) + 1),
      calibration_score: t.calibration_score,
    }))
  , [brierByTopic]);

  // --- Unlock threshold (all-time) ---
  if (confidenceFillRateAllTime < 30) {
    return (
      <div>
        <p className="text-sm text-neutral-500">
          Indiquez votre confiance sur plus de réponses pour débloquer ce graphique.
        </p>
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(confidenceFillRateAllTime / 30 * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {Math.round(confidenceFillRateAllTime)}% / 30% requis
          </p>
        </div>
      </div>
    );
  }

  // --- Compact mode ---
  if (compact) {
    return (
      <div>
        <div className="grid grid-cols-3 gap-2">
          {averages.map((d) => (
            <div key={d.label} className="text-center">
              <p className="text-lg font-bold text-neutral-900">{d.avg}%</p>
              <p className="text-xs text-neutral-500">{d.label}</p>
              <p className="text-[10px] text-neutral-400">{d.count} rép.</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Multi-view rendering ---
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void data;

  const srSummary = averages
    .map((d) => `${d.label}: ${d.avg}% réussite moyenne, ${d.count} réponses`)
    .join('. ');

  return (
    <div>
      {/* View: scatter */}
      <div className={view === 'scatter' ? '' : 'hidden'}>
        <div aria-label="Graphique de calibration" role="img">
          <p className="sr-only">{srSummary}</p>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 15, bottom: 5, left: -10 }}>
              <defs>
                <filter id="dotShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e4eb" strokeOpacity={0.35} vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0.4, 3.6]}
                ticks={[1, 2, 3]}
                tickFormatter={(v: number) => CONFIDENCE_LABELS[{ 1: 0, 2: 0.5, 3: 1 }[v] ?? 0] ?? ''}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;
                  return (
                    <div className="rounded-lg border-none bg-white px-3 py-2 text-xs" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                      <p className="font-semibold text-neutral-700">{item.label}</p>
                      <p className="mt-1 text-neutral-600">Score : {Math.round(item.y)}%</p>
                    </div>
                  );
                }}
              />
              {/* Reference lines for expected accuracy at each confidence level */}
              {REFERENCE_LINES.map((ref) => (
                <ReferenceLine
                  key={ref.y}
                  y={ref.y}
                  stroke="#9ca3af"
                  strokeDasharray="6 4"
                  strokeWidth={1}
                  strokeOpacity={0.5}
                  label=""
                />
              ))}
              <Scatter
                data={scatterData}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
                style={{ filter: 'url(#dotShadow)' }}
              >
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={CONFIDENCE_COLORS[entry.confidence]}
                    fillOpacity={0.7}
                    stroke="#fff"
                    strokeWidth={1}
                    r={5.5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[10px] text-neutral-500">
            {[0, 0.5, 1].map((conf) => (
              <span key={conf} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[conf] }} />
                {CONFIDENCE_LABELS[conf]}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block h-px w-3" style={{ borderTop: '2px dashed #9ca3af' }} />
              Attendu
            </span>
          </div>
          {/* Diagnosis */}
          {diagnosis && (
            <p className="mt-1.5 text-center text-[11px] font-medium" style={{ color: diagnosis.color }}>
              {diagnosis.label}
            </p>
          )}
        </div>
      </div>

      {/* View: evolution */}
      <div className={view === 'evolution' ? '' : 'hidden'}>
        {evolutionData.length < 2 ? (
          <p className="py-8 text-center text-sm text-neutral-400">
            Pas assez de données pour afficher l&apos;évolution.
          </p>
        ) : (
          <div>
            <div className="mb-2 flex items-center gap-1">
              <p className="text-xs text-neutral-500">Score de calibration par jour</p>
              <span className="text-neutral-400" title="100 = confiance parfaitement alignée avec vos résultats. 75 = incertitude moyenne. Plus le score monte, mieux vous vous connaissez.">
                <InfoIcon size={14} />
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={evolutionData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e4eb" strokeOpacity={0.4} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value}%`, 'Calibration']}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '8px 12px' }}
                />
                <defs>
                  <linearGradient id="brierGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#194ce6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#194ce6" stopOpacity={0.01} />
                  </linearGradient>
                  <filter id="brierLineShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#194ce6" floodOpacity="0.2" />
                  </filter>
                </defs>
                <Area
                  type="monotone"
                  dataKey="calibration_score"
                  stroke="#194ce6"
                  strokeWidth={2.5}
                  fill="url(#brierGradient)"
                  dot={{ r: 3.5, fill: '#194ce6', stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#194ce6', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                  style={{ filter: 'url(#brierLineShadow)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* View: topics treemap */}
      <div className={view === 'topics' ? '' : 'hidden'}>
        {treemapData.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">
            Pas assez de données par thème (min. 5 réponses avec confiance).
          </p>
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={280}>
              <Treemap
                data={treemapData}
                dataKey="size"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={((props: any) => <CalibrationTreemapCell {...props} onCellClick={(topicId: string) => {
                  const topic = brierByTopic.find(t => t.topic_id === topicId);
                  if (topic && onTopicSelect) onTopicSelect(topic);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }} />) as any}
                isAnimationActive={true}
                animationDuration={600}
              />
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[10px] text-neutral-500">
              {[
                { label: 'Mal calibré', color: '#B91C1C' },
                { label: 'En progression', color: '#D97706' },
                { label: 'Bien calibré', color: '#10B981' },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Detail panel for treemap topic drill-down
// ---------------------------------------------------------------------------

export function CalibrationTopicDetailPanel({
  topic,
  details,
  loading,
  onClose,
}: {
  topic: BrierTopicPoint;
  details: TopicCalibrationDetail[] | null;
  loading: boolean;
  onClose: () => void;
}) {
  const color = getCalibrationColor(topic.calibration_score);

  // Diagnosis for this topic
  const diagnosis = (() => {
    if (!details || details.length === 0) return null;
    let overCount = 0, underCount = 0, counted = 0;
    for (const d of details) {
      if (d.total_answers < 3) continue;
      const expected = EXPECTED[d.confidence_level] ?? 50;
      const gap = d.success_rate - expected;
      if (gap < -10) overCount++;
      if (gap > 10) underCount++;
      counted++;
    }
    if (counted === 0) return null;
    if (overCount > underCount) return { label: 'Surconfiant', color: '#B45309' };
    if (underCount > overCount) return { label: 'Sous-confiant', color: '#0ea5e9' };
    return { label: 'Bien calibré', color: '#10B981' };
  })();

  return (
    <div className="mt-3 glass-card-inner p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-neutral-800">{topic.topic_title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Fermer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-lg font-bold" style={{ color }}>
          {Math.round(topic.calibration_score)}%
        </span>
        <span className="text-xs text-neutral-500">calibration</span>
        {diagnosis && (
          <span className="text-xs font-medium" style={{ color: diagnosis.color }}>
            · {diagnosis.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 flex-1 animate-pulse rounded-lg bg-white/30" />
          ))}
        </div>
      ) : details && details.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 0.5, 1].map((conf) => {
            const d = details.find((x) => x.confidence_level === conf);
            const confColor = CONFIDENCE_COLORS[conf];
            return (
              <div
                key={conf}
                className="rounded-lg p-2.5"
                style={{ backgroundColor: `${confColor}10`, borderLeft: `3px solid ${confColor}` }}
              >
                <p className="text-[10px] font-medium" style={{ color: confColor }}>
                  {CONFIDENCE_LABELS[conf]}
                </p>
                <p className="mt-1 text-lg font-bold text-neutral-800">
                  {d ? `${Math.round(d.success_rate)}%` : '—'}
                </p>
                <p className="text-[10px] text-neutral-400">
                  {d ? `${d.total_answers} rép.` : 'Aucune'}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-400">Aucune donnée disponible.</p>
      )}
    </div>
  );
}
