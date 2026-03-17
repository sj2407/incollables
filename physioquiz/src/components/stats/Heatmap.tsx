'use client';

import { memo, useState, useCallback } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, Treemap } from 'recharts';
import { getMasteryColor, getMasteryLabel, MASTERY_SCALE } from '@/lib/mastery';
import { createClient } from '@/lib/supabase/client';

export interface HeatmapNode {
  name: string;
  topic_id: string;
  size: number; // question count
  mastery: number | null; // 0-100 or null
  coverage: number; // 0-100
  children?: HeatmapNode[];
}

interface TopicDetailStats {
  session_count: number;
  total_questions_answered: number;
  correct_count: number;
  wrong_count: number;
  partial_count: number;
  avg_score: number;
  total_time_seconds: number;
  avg_confidence: number;
  confidence_fill_rate: number;
}

interface HeatmapProps {
  data: HeatmapNode[];
  /** Compact mode for dashboard miniature */
  compact?: boolean;
}

// Custom content renderer for Treemap cells
function TreemapCell(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  mastery: number | null;
  coverage: number;
  topic_id: string;
  depth: number;
  index: number;
}) {
  const { x, y, width, height, name, mastery, coverage, depth } = props;

  // Inset each cell by a gap to create padding between blocks
  const gap = 4;
  const cx = x + gap;
  const cy = y + gap;
  const cw = width - gap * 2;
  const ch = height - gap * 2;

  if (depth !== 1 || cw < 4 || ch < 4) return null;

  const color = getMasteryColor(mastery);
  const showText = cw > 40 && ch > 35;
  const showBar = cw > 50 && ch > 55;

  // Use dark text on light backgrounds for contrast
  const needsDarkText = mastery !== null && mastery >= 60 && mastery < 90;
  const textColor = needsDarkText ? '#1f2937' : '#fff';
  const subTextColor = needsDarkText ? 'rgba(31,41,55,0.75)' : 'rgba(255,255,255,0.85)';

  const masteryText = mastery !== null && mastery >= 0 ? `${Math.round(mastery)}%` : '—';
  const tooltipText = `${name}\nScore : ${masteryText}\nCouverture : ${Math.round(coverage)}%`;

  const barTrackColor = needsDarkText ? 'rgba(31,41,55,0.15)' : 'rgba(255,255,255,0.3)';
  const barFillColor = needsDarkText ? 'rgba(31,41,55,0.5)' : 'rgba(255,255,255,0.8)';

  return (
    <g>
      <rect
        x={cx}
        y={cy}
        width={cw}
        height={ch}
        rx={12}
        fill={color}
        stroke="none"
        style={{ cursor: 'pointer' }}
      >
        <title>{tooltipText}</title>
      </rect>
      {showText && (
        <foreignObject x={cx + 8} y={cy + 6} width={cw - 16} height={ch - 12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '2px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: textColor,
                wordBreak: 'break-word',
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {name}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: subTextColor,
                marginTop: 3,
              }}
            >
              {masteryText}
            </span>
            {showBar && (
              <div
                style={{
                  marginTop: 6,
                  width: '100%',
                  maxWidth: 80,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: barTrackColor,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(coverage)}%`,
                    height: '100%',
                    borderRadius: 2,
                    backgroundColor: barFillColor,
                  }}
                />
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}min` : `${h}h`;
}

function TopicDetailPanel({
  node,
  stats,
  loading,
  onClose,
}: {
  node: HeatmapNode;
  stats: TopicDetailStats | null;
  loading: boolean;
  onClose: () => void;
}) {
  const color = getMasteryColor(node.mastery);
  const label = getMasteryLabel(node.mastery);

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-neutral-800">{node.name}</h3>
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
          {node.mastery !== null ? `${Math.round(node.mastery)}%` : '—'}
        </span>
        <span className="text-xs text-neutral-500">{label}</span>
      </div>

      {loading ? (
        <div className="mt-3 flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 flex-1 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-neutral-50 p-2.5">
              <p className="text-[10px] font-medium text-neutral-500">Sessions</p>
              <p className="text-sm font-bold text-neutral-800">{stats.session_count}</p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-2.5">
              <p className="text-[10px] font-medium text-neutral-500">Questions</p>
              <p className="text-sm font-bold text-neutral-800">{stats.total_questions_answered}</p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-2.5">
              <p className="text-[10px] font-medium text-neutral-500">Temps total</p>
              <p className="text-sm font-bold text-neutral-800">{formatTime(stats.total_time_seconds)}</p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-2.5">
              <p className="text-[10px] font-medium text-neutral-500">Score moyen</p>
              <p className="text-sm font-bold text-neutral-800">{stats.avg_score}%</p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-secondary-50 p-2.5">
              <p className="text-[10px] font-medium text-secondary-600">Correctes</p>
              <p className="text-sm font-bold text-secondary-700">{stats.correct_count}</p>
            </div>
            <div className="rounded-lg bg-warning/10 p-2.5">
              <p className="text-[10px] font-medium text-warning">Partielles</p>
              <p className="text-sm font-bold text-warning">{stats.partial_count}</p>
            </div>
            <div className="rounded-lg bg-error/10 p-2.5">
              <p className="text-[10px] font-medium text-error">Incorrectes</p>
              <p className="text-sm font-bold text-error">{stats.wrong_count}</p>
            </div>
          </div>

          {stats.avg_confidence > 0 && (
            <div className="mt-2 rounded-lg bg-primary-50 p-2.5">
              <p className="text-[10px] font-medium text-primary">Confiance moyenne</p>
              <p className="text-sm font-bold text-primary-700">
                {stats.avg_confidence}%
                <span className="ml-2 text-[10px] font-normal text-primary">
                  ({stats.confidence_fill_rate}% des réponses)
                </span>
              </p>
            </div>
          )}

          <p className="mt-2 text-[10px] text-neutral-400">
            Couverture : {Math.round(node.coverage)}% ({node.size} questions au total)
          </p>

          <Link
            href={`/quiz/setup/${node.topic_id}`}
            className="mt-3 block w-full rounded-lg border border-primary/20 px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary-50"
          >
            Réviser ce chapitre
          </Link>
        </>
      ) : (
        <p className="mt-3 text-xs text-neutral-400">Aucune donnée disponible.</p>
      )}
    </div>
  );
}

export default memo(function Heatmap({ data, compact = false }: HeatmapProps) {
  const [selectedNode, setSelectedNode] = useState<HeatmapNode | null>(null);
  const [detailStats, setDetailStats] = useState<TopicDetailStats | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTopicDetail = useCallback(async (topicId: string) => {
    setDetailLoading(true);
    setDetailStats(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDetailLoading(false);
      return;
    }
    const { data: result } = await supabase.rpc('get_topic_detail_stats', {
      p_user_id: user.id,
      p_topic_id: topicId,
    });
    if (result) {
      setDetailStats(result as TopicDetailStats);
    }
    setDetailLoading(false);
  }, []);

  const handleNodeClick = useCallback((node: HeatmapNode) => {
    if (selectedNode?.topic_id === node.topic_id) {
      setSelectedNode(null);
      setDetailStats(null);
      return;
    }
    setSelectedNode(node);
    fetchTopicDetail(node.topic_id);
  }, [selectedNode, fetchTopicDetail]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleTreemapClick = useCallback((nodeData: any) => {
    if (nodeData?.topic_id) {
      const node = data.find((d) => d.topic_id === nodeData.topic_id);
      if (node) handleNodeClick(node);
    }
  }, [data, handleNodeClick]);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-400">
        Aucune donnée de maîtrise disponible.
      </p>
    );
  }

  // Use log scale so a topic with 200 questions isn't 200x bigger than one with 1
  const treemapData = data.map((node) => ({
    name: node.name,
    topic_id: node.topic_id,
    size: Math.log2(Math.max(node.size, 1) + 1),
    mastery: node.mastery,
    coverage: node.coverage,
    color: getMasteryColor(node.mastery),
  }));

  if (compact) {
    return (
      <div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {data.slice(0, 12).map((node) => (
            <button
              key={node.topic_id}
              type="button"
              onClick={() => handleNodeClick(node)}
              className={`min-h-[44px] rounded-lg p-2 text-center transition-transform hover:scale-105 ${
                selectedNode?.topic_id === node.topic_id ? 'ring-2 ring-primary ring-offset-1' : ''
              }`}
              style={{ backgroundColor: getMasteryColor(node.mastery) }}
            >
              <p className="line-clamp-2 text-[10px] font-semibold text-white">
                {node.name}
              </p>
              <p className="text-[10px] font-bold text-white/90">
                {node.mastery !== null && node.mastery >= 0
                  ? `${Math.round(node.mastery)}%`
                  : '—'}
              </p>
            </button>
          ))}
        </div>
        {selectedNode && (
          <TopicDetailPanel
            node={selectedNode}
            stats={detailStats}
            loading={detailLoading}
            onClose={() => { setSelectedNode(null); setDetailStats(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Desktop/tablet: Recharts Treemap */}
      <div aria-label="Carte de chaleur des connaissances" role="img">
        <p className="sr-only">
          Carte de maîtrise : {data.length} chapitres.
          {data.filter(n => n.mastery !== null && n.mastery >= 0).length} tentés.
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="none"
            content={<TreemapCell x={0} y={0} width={0} height={0} name="" mastery={null} coverage={0} topic_id="" depth={0} index={0} />}
            onClick={handleTreemapClick}
          />
        </ResponsiveContainer>
        {/* Keyboard-accessible list */}
        <ul className="sr-only">
          {data.map((node) => (
            <li key={node.topic_id}>
              <button type="button" onClick={() => handleNodeClick(node)}>
                {node.name} — {node.mastery !== null && node.mastery >= 0 ? `${Math.round(node.mastery)}%` : 'Non tenté'} — {node.size} questions
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile: card-based fallback (hidden — treemap shown on all sizes) */}
      <div className="hidden flex-col gap-2">
        {data.map((node) => (
          <button
            key={node.topic_id}
            type="button"
            onClick={() => handleNodeClick(node)}
            className={`flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-md transition-colors hover:bg-neutral-50 ${
              selectedNode?.topic_id === node.topic_id ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-4 w-4 shrink-0 rounded"
                style={{ backgroundColor: getMasteryColor(node.mastery) }}
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-neutral-700">
                  {node.name}
                </p>
                <p className="text-xs text-neutral-400">
                  {node.size} questions · {getMasteryLabel(node.mastery)}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-bold text-neutral-700">
              {node.mastery !== null && node.mastery >= 0
                ? `${Math.round(node.mastery)}%`
                : '—'}
            </span>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <TopicDetailPanel
          node={selectedNode}
          stats={detailStats}
          loading={detailLoading}
          onClose={() => { setSelectedNode(null); setDetailStats(null); }}
        />
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {MASTERY_SCALE.map((level) => (
          <div key={level.label} className="flex items-center gap-1">
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: level.color }}
            />
            <span className="text-[10px] text-neutral-500">{level.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
