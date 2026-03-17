'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import type { ChoiceData } from '@/types/admin';

interface CorrectAnswersPopupProps {
  questionId: string;
  choices: ChoiceData[];
  onSaved: () => void;
  onClose: () => void;
}

export default function CorrectAnswersPopup({
  questionId,
  choices,
  onSaved,
  onClose,
}: CorrectAnswersPopupProps) {
  const [correctIds, setCorrectIds] = useState<Set<string>>(
    () => new Set(choices.filter((c) => c.is_correct).map((c) => c.id))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCorrect = correctIds.size > 0;

  const toggleChoice = useCallback((id: string) => {
    setCorrectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasCorrect) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // Atomic batch update via RPC
    const { error: rpcError } = await supabase.rpc('update_correct_answers', {
      p_question_id: questionId,
      p_correct_ids: Array.from(correctIds),
    });

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    // Mark question as draft so Synchroniser picks it up (fire-and-forget to avoid blocking)
    supabase.from('questions').update({ is_draft: true }).eq('id', questionId).then(({ error: draftErr }) => {
      if (draftErr) console.error('Failed to mark draft:', draftErr.message);
    });

    // Log
    const oldLabels = choices.filter((c) => c.is_correct).map((c) => c.label).join(', ');
    const newLabels = choices.filter((c) => correctIds.has(c.id)).map((c) => c.label).join(', ');
    supabase.rpc('log_admin_edit', {
      p_question_id: questionId,
      p_field: 'correct_labels',
      p_old: oldLabels,
      p_new: newLabels,
    }).then(({ error: logError }) => {
      if (logError) console.error('Failed to log admin edit:', logError.message);
    });

    setSaving(false);
    onSaved();
  }, [choices, correctIds, hasCorrect, questionId, onSaved]);

  return (
    <Modal onClose={onClose} title="Réponses correctes" maxWidth="max-w-sm">
      {error && <p role="alert" className="mb-3 text-sm text-error">{error}</p>}

      <div className="space-y-2">
        {choices.map((choice) => (
          <label
            key={choice.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 p-3 transition-colors hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={correctIds.has(choice.id)}
              onChange={() => toggleChoice(choice.id)}
              className="h-5 w-5 rounded border-neutral-300 text-secondary-500 focus:ring-secondary-500"
            />
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
              correctIds.has(choice.id) ? 'bg-secondary-500 text-white' : 'bg-neutral-100 text-neutral-500'
            }`}>
              {choice.label}
            </span>
            <span className="flex-1 text-sm text-neutral-700">{choice.choice_text}</span>
          </label>
        ))}
      </div>

      {!hasCorrect && (
        <p className="mt-2 text-xs font-medium text-warning">Au moins une réponse doit être marquée correcte.</p>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasCorrect || saving}
          className="min-h-[44px] rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}
