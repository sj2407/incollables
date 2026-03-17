'use client';

import { X } from '@phosphor-icons/react';

export interface Proposition {
  id?: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
}

interface PropositionEditorProps {
  propositions: Proposition[];
  onChange: (propositions: Proposition[]) => void;
}

const LABELS = ['A', 'B', 'C', 'D', 'E'];

export default function PropositionEditor({ propositions, onChange }: PropositionEditorProps) {
  const canAdd = propositions.length < 5;
  const canRemove = propositions.length > 2;

  function updateProp(index: number, field: keyof Proposition, value: string | boolean) {
    const updated = propositions.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    onChange(updated);
  }

  function addProp() {
    if (!canAdd) return;
    onChange([
      ...propositions,
      { label: LABELS[propositions.length], choice_text: '', is_correct: false },
    ]);
  }

  function removeProp(index: number) {
    if (!canRemove) return;
    const updated = propositions
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, label: LABELS[i] }));
    onChange(updated);
  }

  return (
    <div>
      <p className="text-sm font-medium text-neutral-700">
        Propositions ({propositions.length})
      </p>
      <div className="mt-2 space-y-2">
        {propositions.map((prop, index) => (
          <div key={index} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
            {/* Label badge */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
              prop.is_correct ? 'bg-secondary-500 text-white' : 'bg-neutral-100 text-neutral-500'
            }`}>
              {LABELS[index]}
            </div>

            {/* Text input */}
            <input
              type="text"
              value={prop.choice_text}
              onChange={(e) => updateProp(index, 'choice_text', e.target.value)}
              placeholder={`Proposition ${LABELS[index]}`}
              className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {/* Correct checkbox */}
            <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={prop.is_correct}
                onChange={(e) => updateProp(index, 'is_correct', e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-secondary-500 focus:ring-secondary-500"
              />
              Correcte
            </label>

            {/* Remove */}
            {canRemove && (
              <button
                type="button"
                onClick={() => removeProp(index)}
                className="min-h-[44px] rounded-lg px-2 text-xs text-neutral-400 hover:bg-red-50 hover:text-error"
                aria-label={`Supprimer proposition ${LABELS[index]}`}
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canAdd && (
        <button
          type="button"
          onClick={addProp}
          className="mt-2 min-h-[44px] rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500 transition-colors hover:border-primary hover:text-primary"
        >
          + Ajouter une proposition
        </button>
      )}
    </div>
  );
}
