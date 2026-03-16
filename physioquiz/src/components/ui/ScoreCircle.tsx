'use client';

import { memo } from 'react';

interface ScoreCircleProps {
  /** Score percentage 0-100, or null for "not attempted" */
  score: number | null;
  /** Diameter in px (default 64) */
  size?: number;
  /** Stroke width in px (default 3) */
  strokeWidth?: number;
  /** Font size for the label in px (default auto based on size) */
  fontSize?: number;
  /** Custom color — defaults to score-based color */
  color?: string;
  /** Optional label override (defaults to "X%") */
  label?: string;
}

function getScoreColor(score: number | null): string {
  if (score === null || score < 0) return '#D1D5DB'; // neutral-300
  if (score >= 75) return '#10B981'; // secondary-500
  if (score >= 40) return '#D97706'; // warning
  return '#DC2626'; // error
}

export default memo(function ScoreCircle({
  score,
  size = 64,
  strokeWidth = 3,
  fontSize,
  color,
  label,
}: ScoreCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null && score >= 0 ? Math.min(score, 100) : 0;
  const offset = circumference - (pct / 100) * circumference;
  const resolvedColor = color ?? getScoreColor(score);
  const resolvedFontSize = fontSize ?? Math.round(size * 0.25);
  const displayLabel = label ?? (score !== null && score >= 0 ? `${Math.round(score)}%` : '—');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={strokeWidth}
      />
      {/* Fill */}
      {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      )}
      {/* Label */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={resolvedFontSize}
        fontWeight={600}
        fill={resolvedColor}
      >
        {displayLabel}
      </text>
    </svg>
  );
});
