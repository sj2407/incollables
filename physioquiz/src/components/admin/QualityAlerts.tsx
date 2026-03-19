'use client';

import Link from 'next/link';

export interface QualityAlert {
  question_id: string;
  question_number: number | null;
  question_text: string;
  topic_title: string;
  alert_type: string;
  error_rate: number;
  attempt_count: number;
}

export function QualityAlerts({ alerts }: { alerts: QualityAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="py-4 text-sm text-secondary-500">
        Aucune alerte qualité. Toutes les questions sont en bon état.
      </p>
    );
  }

  const noChoices = alerts.filter((a) => a.alert_type === 'no_choices');
  const highError = [...alerts.filter((a) => a.alert_type === 'high_error_rate')]
    .sort((a, b) => b.attempt_count * b.error_rate - a.attempt_count * a.error_rate);

  return (
    <div className="space-y-4">
      {noChoices.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-error">
            Sans propositions ({noChoices.length})
          </p>
          <div className="max-h-[210px] overflow-y-auto glass-card-inner">
            <div className="flex flex-col gap-1.5 p-2">
              {noChoices.map((a) => (
                <AlertRow key={a.question_id} alert={a} />
              ))}
            </div>
          </div>
        </div>
      )}
      {highError.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-warning">
            Taux d&apos;erreur &gt; 80% ({highError.length})
          </p>
          <div className="max-h-[210px] overflow-y-auto glass-card-inner">
            <div className="flex flex-col gap-1.5 p-2">
              {highError.map((a) => (
                <AlertRow key={a.question_id} alert={a} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: QualityAlert }) {
  const isNoChoices = alert.alert_type === 'no_choices';

  return (
    <Link
      href={`/admin/questions?edit=${alert.question_id}`}
      className="flex items-center justify-between rounded-lg glass-card-inner p-3 transition-colors hover:bg-white/70"
      style={{ borderLeft: `4px solid ${isNoChoices ? '#B91C1C' : '#B45309'}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-neutral-700">
            {alert.question_number ? `Q${alert.question_number}. ` : ''}
            {alert.question_text}
          </p>
          <span className={`shrink-0 text-xs font-bold ${isNoChoices ? 'text-error' : 'text-warning'}`}>
            {isNoChoices ? '0 prop.' : `${(alert.error_rate * alert.attempt_count / 100).toFixed(2)} err.`}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-neutral-400">
          {alert.topic_title}
        </p>
      </div>
    </Link>
  );
}
