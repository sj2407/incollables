'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';

interface EditLogEntry {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  question_text: string | null;
}

interface EditLogPanelProps {
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  question_text: 'Énoncé',
  difficulty: 'Difficulté',
  is_active: 'Active',
  explanation_html: 'Explication',
  topic_id: 'Chapitre',
  propositions: 'Propositions',
  correct_labels: 'Réponses correctes',
  bulk_move: 'Déplacement',
  bulk_activate: 'Activation',
  bulk_deactivate: 'Désactivation',
  bulk_delete: 'Suppression',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function truncate(s: string | null, max: number): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export default function EditLogPanel({ onClose }: EditLogPanelProps) {
  const [entries, setEntries] = useState<EditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (off: number, append: boolean) => {
    setLoading(true);
    setFetchError(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('admin_edit_log')
      .select(`
        id,
        field_changed,
        old_value,
        new_value,
        created_at,
        questions!admin_edit_log_question_id_fkey ( question_text )
      `)
      .order('created_at', { ascending: false })
      .range(off, off + PAGE_SIZE - 1);

    if (error || !data) {
      setFetchError(error?.message ?? 'Erreur lors du chargement.');
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: EditLogEntry[] = (data as any[]).map((row) => ({
      id: row.id,
      field_changed: row.field_changed,
      old_value: row.old_value,
      new_value: row.new_value,
      created_at: row.created_at,
      question_text: row.questions?.question_text ?? null,
    }));

    if (append) {
      setEntries((prev) => [...prev, ...mapped]);
    } else {
      setEntries(mapped);
    }
    setHasMore(mapped.length === PAGE_SIZE);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries(0, false);
  }, [fetchEntries]);

  const handleLoadMore = useCallback(() => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchEntries(newOffset, true);
  }, [offset, fetchEntries]);

  // Group entries by date
  const grouped = entries.reduce<Record<string, EditLogEntry[]>>((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString('fr-FR');
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <Modal onClose={onClose} title="Historique des modifications" maxWidth="max-w-2xl">
      {fetchError && (
        <p role="alert" className="mb-4 text-sm text-error">{fetchError}</p>
      )}

      {entries.length === 0 && !loading && !fetchError && (
        <p className="py-8 text-center text-sm text-neutral-400">Aucune modification enregistrée.</p>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-400">{date}</h3>
          <div className="space-y-2">
            {items.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                      {FIELD_LABELS[entry.field_changed] ?? entry.field_changed}
                    </span>
                    {entry.question_text && (
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {truncate(entry.question_text, 80)}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
                      <span className="text-neutral-400 line-through">{truncate(entry.old_value, 60)}</span>
                      <span className="text-neutral-300">→</span>
                      <span className="font-medium text-neutral-700">{truncate(entry.new_value, 60)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      )}

      {hasMore && !loading && entries.length > 0 && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="mt-4 w-full rounded-lg border border-neutral-200 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-50"
        >
          Charger plus
        </button>
      )}
    </Modal>
  );
}
