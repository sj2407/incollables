'use client';

import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';
import CountUp from '@/components/ui/CountUp';
import TiltCard from '@/components/ui/TiltCard';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  borderColor: string;
  tooltip: string;
  numericValue?: number;
  numericSuffix?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export function MetricCard({ label, value, icon, borderColor, tooltip, numericValue, numericSuffix, trend }: MetricCardProps) {
  const trendColor =
    trend && trend.value > 0
      ? 'text-secondary-500'
      : trend && trend.value < 0
        ? 'text-error'
        : 'text-neutral-400';

  const trendPrefix = trend && trend.value > 0 ? '+' : '';
  const trendIcon =
    trend && trend.value > 0
      ? <TrendUp size={14} weight="bold" />
      : trend && trend.value < 0
        ? <TrendDown size={14} weight="bold" />
        : <Minus size={14} />;

  return (
    <TiltCard
      tiltDeg={6}
      className="group relative overflow-hidden glass-card p-3"
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
      <p className="mt-1.5 text-xl font-bold text-neutral-900">
        {numericValue !== undefined ? <CountUp end={numericValue} suffix={numericSuffix} /> : value}
      </p>
      {trend && (
        <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          {trendIcon} {trendPrefix}{trend.value}% {trend.label}
        </p>
      )}
    </TiltCard>
  );
}

// Re-export Phosphor icons with color prop for backward compatibility
import { ChartBar, Users, Timer, Flask } from '@phosphor-icons/react';

export function ChartIcon({ color }: { color: string }) {
  return <ChartBar size={16} color={color} weight="duotone" />;
}

export function SessionsIcon({ color }: { color: string }) {
  return <Users size={16} color={color} weight="duotone" />;
}

export function TimerIcon({ color }: { color: string }) {
  return <Timer size={16} color={color} weight="duotone" />;
}

export function FlaskIcon({ color }: { color: string }) {
  return <Flask size={16} color={color} weight="duotone" />;
}
