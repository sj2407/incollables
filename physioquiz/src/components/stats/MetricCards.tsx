'use client';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  borderColor: string;
  tooltip: string;
  trend?: {
    value: number;
    label: string;
  };
}

export function MetricCard({ label, value, icon, borderColor, tooltip, trend }: MetricCardProps) {
  const trendColor =
    trend && trend.value > 0
      ? 'text-secondary-500'
      : trend && trend.value < 0
        ? 'text-error'
        : 'text-neutral-400';

  const trendPrefix = trend && trend.value > 0 ? '+' : '';
  const trendIcon =
    trend && trend.value > 0
      ? '\u2197'
      : trend && trend.value < 0
        ? '\u2198'
        : '\u2014';

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 shadow-md"
      style={{ borderLeft: `4px solid ${borderColor}` }}
      title={tooltip}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${borderColor}20` }}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>
      {trend && (
        <p className={`mt-1.5 text-xs font-medium ${trendColor}`}>
          {trendIcon} {trendPrefix}{trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}

// SVG icons matching the reference design
export function ChartIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="8" width="3" height="7" rx="1" fill={color} opacity="0.5" />
      <rect x="6" y="4" width="3" height="11" rx="1" fill={color} opacity="0.7" />
      <rect x="11" y="1" width="3" height="14" rx="1" fill={color} />
    </svg>
  );
}

export function SessionsIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="3" fill={color} opacity="0.7" />
      <circle cx="11" cy="5" r="2.5" fill={color} opacity="0.5" />
      <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" fill={color} opacity="0.3" />
    </svg>
  );
}

export function TimerIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="9" r="6" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M8 6v3.5l2.5 1.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 1h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function FlaskIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 1h4v4l3 8H3l3-8V1z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 1h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
