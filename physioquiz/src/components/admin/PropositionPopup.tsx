'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import PropositionEditor, { type Proposition } from './PropositionEditor';
import type { ChoiceData } from '@/types/admin';

interface PropositionPopupProps {
  questionId: string;
  choices: ChoiceData[];
  onSaved: () => void;
  onClose: () => void;
}

export default function PropositionPopup({
  questionId,
  choices,
  onSaved,
  onClose,
}: PropositionPopupProps) {
  const [propositions, setPropositions] = useState<Proposition[]>(() =>
    choices.length >= 2
      ? choices.map((c) => ({
          id: c.id,
          label: c.label,
          choice_text: c.choice_text,
          is_correct: c.is_correct,
        }))
      : [
          { label: 'A', choice_text: '', is_correct: false },
          { label: 'B', choice_text: '', is_correct: false },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCorrect = propositions.some((p) => p.is_correct);
  const allCorrect = propositions.length > 0 && propositions.every((p) => p.is_correct);
  const allFilled = propositions.every((p) => p.choice_text.trim());
  const canSave = hasCorrect && allFilled && !saving;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // Use transactional RPC (atomic delete+insert)
    const choicesJson = JSON.stringify(
      propositions.map((p, i) => ({
        label: p.label,
        choice_text: p.choice_text,
        is_correct: p.is_correct,
        sort_order: i,
      }))
    );

    const { error: rpcError } = await supabase.rpc('upsert_question_choices', {
      p_question_id: questionId,
      p_choices: choicesJson,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    // Choices trigger auto-updates current_hash on the parent question

    // Log edit
    supabase.rpc('log_admin_edit', {
      p_question_id: questionId,
      p_field: 'propositions',
      p_old: choices.map((c) => `${c.label}:${c.choice_text}`).join(' | '),
      p_new: propositions.map((p) => `${p.label}:${p.choice_text}`).join(' | '),
    }).then(({ error: logError }) => {
      if (logError) console.error('Failed to log admin edit:', logError.message);
    });

    setSaving(false);
    onSaved();
  }, [questionId, propositions, choices, onSaved]);

  return (
    <Modal onClose={onClose} title="Modifier les propositions" maxWidth="max-w-xl">
      {error && <p role="alert" className="mb-3 text-sm text-error">{error}</p>}

      <PropositionEditor propositions={propositions} onChange={setPropositions} />

      {!hasCorrect && propositions.length > 0 && (
        <p className="mt-2 text-xs font-medium text-warning">Au moins une proposition doit être marquée correcte.</p>
      )}
      {allCorrect && propositions.length > 1 && (
        <p className="mt-2 text-xs font-medium text-warning">Toutes les propositions sont marquées correctes — est-ce intentionnel ?</p>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-2xl glass-btn-secondary px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="min-h-[44px] rounded-2xl bg-primary glass-btn px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}
