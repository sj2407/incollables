'use client';

import { useState } from 'react';
import PropositionEditor, { type Proposition } from './PropositionEditor';
import HtmlPreview from './HtmlPreview';

export interface QuestionFormData {
  question_text: string;
  topic_id: string;
  difficulty: string;
  is_active: boolean;
  explanation_html: string;
  propositions: Proposition[];
}

interface TopicOption {
  id: string;
  title: string;
  level: number;
}

interface QuestionEditorFormProps {
  initial: QuestionFormData;
  topics: TopicOption[];
  isNew: boolean;
  saving: boolean;
  onSave: (data: QuestionFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function QuestionEditorForm({
  initial,
  topics,
  isNew,
  saving,
  onSave,
  onDelete,
}: QuestionEditorFormProps) {
  const [questionText, setQuestionText] = useState(initial.question_text);
  const [topicId, setTopicId] = useState(initial.topic_id);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [isActive, setIsActive] = useState(initial.is_active);
  const [explanationHtml, setExplanationHtml] = useState(initial.explanation_html);
  const [propositions, setPropositions] = useState<Proposition[]>(initial.propositions);

  const hasCorrect = propositions.some((p) => p.is_correct);
  const allFilled = propositions.every((p) => p.choice_text.trim());
  const canSave = questionText.trim() && topicId && hasCorrect && allFilled && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    await onSave({
      question_text: questionText.trim(),
      topic_id: topicId,
      difficulty,
      is_active: isActive,
      explanation_html: explanationHtml,
      propositions,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Topic + Difficulty row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="q-topic" className="text-sm font-medium text-neutral-700">Chapitre</label>
          <select
            id="q-topic"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            required
            className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Sélectionner...</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {'— '.repeat(t.level)}{t.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="q-diff" className="text-sm font-medium text-neutral-700">Difficulté</label>
          <select
            id="q-diff"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="easy">Facile</option>
            <option value="medium">Moyen</option>
            <option value="hard">Difficile</option>
          </select>
        </div>
      </div>

      {/* Question text */}
      <div>
        <label htmlFor="q-text" className="text-sm font-medium text-neutral-700">Énoncé</label>
        <textarea
          id="q-text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
          rows={4}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Propositions */}
      <PropositionEditor propositions={propositions} onChange={setPropositions} />

      {!hasCorrect && propositions.length > 0 && (
        <p className="text-xs text-warning">Au moins une proposition doit être correcte.</p>
      )}

      {/* Explanation HTML */}
      <HtmlPreview
        id="q-explanation"
        label="Explication (HTML)"
        value={explanationHtml}
        onChange={setExplanationHtml}
      />

      {/* Active toggle */}
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-5 w-5 rounded-md border-neutral-300 text-primary focus:ring-primary"
        />
        <span className="text-sm font-medium text-neutral-700">Question active</span>
      </label>

      {/* Actions */}
      <div className="flex gap-3 border-t border-neutral-200 pt-4">
        {!isNew && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="min-h-[44px] rounded-lg border border-error px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Supprimer
          </button>
        )}
        <div className="flex-1" />
        <button
          type="submit"
          disabled={!canSave}
          className="min-h-[44px] rounded-xl bg-primary px-6 py-2 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
        >
          {saving ? 'Enregistrement...' : isNew ? 'Créer la question' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
