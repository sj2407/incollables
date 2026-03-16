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
  const highError = alerts.filter((a) => a.alert_type === 'high_error_rate');

  return (
    <div className="space-y-4">
      {noChoices.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-error">
            Sans propositions ({noChoices.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {noChoices.map((a) => (
              <AlertRow key={a.question_id} alert={a} />
            ))}
          </div>
        </div>
      )}
      {highError.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-warning">
            Taux d&apos;erreur &gt; 80% ({highError.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {highError.map((a) => (
              <AlertRow key={a.question_id} alert={a} />
            ))}
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
      className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:bg-neutral-50"
      style={{ borderLeft: `4px solid ${isNoChoices ? '#B91C1C' : '#B45309'}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-700">
          {alert.question_number ? `Q${alert.question_number}. ` : ''}
          {alert.question_text}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {alert.topic_title}
        </p>
      </div>
      <span className={`shrink-0 text-xs font-bold ${isNoChoices ? 'text-error' : 'text-warning'}`}>
        {isNoChoices ? '0 prop.' : `${alert.error_rate}% err.`}
      </span>
    </Link>
  );
}
