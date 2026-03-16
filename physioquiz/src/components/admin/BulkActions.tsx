'use client';

import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

interface BulkActionsProps {
  selectedIds: Set<string>;
  onDone: () => void;
  onClear: () => void;
}

export default function BulkActions({ selectedIds, onDone, onClear }: BulkActionsProps) {
  const [loading, setLoading] = useState(false);
  const count = selectedIds.size;

  async function bulkUpdate(is_active: boolean) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('questions')
      .update({ is_active })
      .in('id', Array.from(selectedIds));
    if (error) {
      alert(`Erreur : ${error.message}`);
    }
    setLoading(false);
    onDone();
  }

  async function bulkDelete() {
    if (!confirm(`Supprimer ${count} question${count > 1 ? 's' : ''} ?`)) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('questions')
      .delete()
      .in('id', Array.from(selectedIds));
    if (error) {
      alert(`Erreur : ${error.message}`);
    }
    setLoading(false);
    onDone();
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-50 px-4 py-2" data-testid="bulk-actions">
      <span className="text-sm font-medium text-primary">
        {count} sélectionnée{count > 1 ? 's' : ''}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => bulkUpdate(true)}
          disabled={loading}
          className="min-h-[44px] rounded-lg bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600 disabled:opacity-50"
        >
          Activer
        </button>
        <button
          type="button"
          onClick={() => bulkUpdate(false)}
          disabled={loading}
          className="min-h-[44px] rounded-lg bg-neutral-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-600 disabled:opacity-50"
        >
          Désactiver
        </button>
        <button
          type="button"
          onClick={bulkDelete}
          disabled={loading}
          className="min-h-[44px] rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto min-h-[44px] text-xs text-neutral-500 hover:text-neutral-700"
      >
        Annuler
      </button>
    </div>
  );
}
