'use client';

export function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-md sm:p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
