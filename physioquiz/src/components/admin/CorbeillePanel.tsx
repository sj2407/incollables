'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';

interface DeletedQuestion {
  question_id: string;
  question_number: number | null;
  question_text: string;
  topic_title: string | null;
  difficulty: string;
  deleted_at: string;
}

interface CorbeillePanelProps {
  onClose: () => void;
  onRestored: () => void;
}

export default function CorbeillePanel({ onClose, onRestored }: CorbeillePanelProps) {
  const [items, setItems] = useState<DeletedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_deleted_questions');
    if (error) {
      setItems([]);
      setLoadError(error.message);
    } else {
      setItems((data as DeletedQuestion[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);

  const handleRestore = useCallback(async (questionId: string) => {
    setRestoring(questionId);
    setRestoreError(null);
    const supabase = createClient();
    const { error } = await supabase.from('questions').update({ deleted_at: null }).eq('id', questionId);
    setRestoring(null);
    if (error) {
      setRestoreError(`Échec de la restauration : ${error.message}`);
      return;
    }
    fetchDeleted();
    onRestored();
  }, [fetchDeleted, onRestored]);

  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'à l\'instant';
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `il y a ${hrs}h`;
  };

  return (
    <Modal onClose={onClose} title={`Corbeille (${items.length})`} maxWidth="max-w-lg">
      {restoreError && <p role="alert" className="mb-3 text-sm text-error">{restoreError}</p>}
      {loading ? (
        <p className="text-sm text-neutral-400">Chargement...</p>
      ) : loadError ? (
        <div role="alert" className="text-sm text-error">
          <p>Impossible de charger la corbeille : {loadError}</p>
          <button
            type="button"
            onClick={fetchDeleted}
            className="mt-2 text-xs font-semibold underline hover:no-underline"
          >
            Réessayer
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-400">La corbeille est vide.</p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {items.map((q) => (
            <div key={q.question_id} className="flex items-center justify-between glass-card-inner px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-800">
                  Q{q.question_number ?? '?'} — {q.question_text.slice(0, 60)}{q.question_text.length > 60 ? '...' : ''}
                </p>
                <p className="text-xs text-neutral-400">
                  {q.topic_title ?? 'Sans chapitre'} · {timeAgo(q.deleted_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(q.question_id)}
                disabled={restoring === q.question_id}
                className="ml-3 shrink-0 rounded-lg bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600 disabled:opacity-50"
              >
                {restoring === q.question_id ? '...' : 'Restaurer'}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-neutral-400">
        Les questions supprimées sont automatiquement purgées après 7 jours.
      </p>
    </Modal>
  );
}
