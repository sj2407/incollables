'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback } from 'react';

export interface QuestionRow {
  question_id: string;
  question_number: number | null;
  question_text: string;
  topic_id: string;
  topic_title: string;
  parent_topic_title: string | null;
  difficulty: string;
  is_active: boolean;
  correct_labels: string;
  has_explanation: boolean;
  total_attempts: number;
  avg_score: number;
}

interface QuestionTableProps {
  questions: QuestionRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRowClick: (id: string) => void;
  onRefresh: () => void;
}

export default function QuestionTable({
  questions,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  onRefresh,
}: QuestionTableProps) {
  const allSelected = questions.length > 0 && questions.every((q) => selectedIds.has(q.question_id));

  const handleToggleActive = useCallback(async (e: React.MouseEvent, questionId: string, currentActive: boolean) => {
    e.stopPropagation();
    const supabase = createClient();
    const { error } = await supabase.from('questions').update({ is_active: !currentActive }).eq('id', questionId);
    if (error) {
      alert(`Erreur : ${error.message}`);
      return;
    }
    onRefresh();
  }, [onRefresh]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onToggleSelect(id);
  }, [onToggleSelect]);

  if (questions.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">Aucune question trouvée.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-md">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                aria-label="Tout sélectionner"
              />
            </th>
            <th className="px-3 py-3">Chapitre</th>
            <th className="hidden px-3 py-3 md:table-cell">Sous-chapitre</th>
            <th className="hidden px-3 py-3 lg:table-cell">Q#</th>
            <th className="px-3 py-3">Énoncé</th>
            <th className="hidden px-3 py-3 md:table-cell">Rép.</th>
            <th className="hidden px-3 py-3 lg:table-cell">Expl.</th>
            <th className="hidden px-3 py-3 md:table-cell">Diff.</th>
            <th className="hidden px-3 py-3 lg:table-cell">Tent.</th>
            <th className="hidden px-3 py-3 lg:table-cell">Score</th>
            <th className="w-20 px-3 py-3 text-center">Active</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr
              key={q.question_id}
              onClick={() => onRowClick(q.question_id)}
              className={`cursor-pointer border-b border-neutral-100 transition-colors hover:bg-primary-50/30 ${
                !q.is_active ? 'opacity-50' : ''
              } ${selectedIds.has(q.question_id) ? 'bg-primary-50/50' : ''}`}
            >
              <td className="px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.question_id)}
                  onChange={() => {}}
                  onClick={(e) => handleCheckboxClick(e, q.question_id)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  aria-label={`Sélectionner Q${q.question_number ?? ''}`}
                />
              </td>
              <td className="px-3 py-2.5">
                <p className="truncate text-xs font-medium text-neutral-700" style={{ maxWidth: 140 }}>
                  {q.parent_topic_title ?? q.topic_title}
                </p>
              </td>
              <td className="hidden px-3 py-2.5 md:table-cell">
                <p className="truncate text-xs text-neutral-500" style={{ maxWidth: 140 }}>
                  {q.parent_topic_title ? q.topic_title : '—'}
                </p>
              </td>
              <td className="hidden px-3 py-2.5 text-neutral-500 lg:table-cell">
                {q.question_number ?? '—'}
              </td>
              <td className="max-w-xs truncate px-3 py-2.5 text-neutral-700">
                {q.question_text}
              </td>
              <td className="hidden px-3 py-2.5 md:table-cell">
                <span className="rounded bg-secondary-50 px-1.5 py-0.5 text-xs font-medium text-secondary-700">
                  {q.correct_labels || '—'}
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-center lg:table-cell">
                {q.has_explanation ? (
                  <span className="text-secondary-500" title="A une explication">✓</span>
                ) : (
                  <span className="text-neutral-300">✗</span>
                )}
              </td>
              <td className="hidden px-3 py-2.5 md:table-cell">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  q.difficulty === 'hard' ? 'bg-red-50 text-red-700' :
                  q.difficulty === 'easy' ? 'bg-green-50 text-green-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {q.difficulty === 'hard' ? 'Diff.' : q.difficulty === 'easy' ? 'Facile' : 'Moyen'}
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-xs text-neutral-500 lg:table-cell">
                {q.total_attempts > 0 ? q.total_attempts : '—'}
              </td>
              <td className="hidden px-3 py-2.5 text-xs lg:table-cell">
                {q.total_attempts > 0 ? (
                  <span className={q.avg_score < 30 ? 'font-bold text-error' : 'text-neutral-500'}>
                    {q.avg_score}%
                  </span>
                ) : '—'}
              </td>
              <td className="px-3 py-2.5 text-center">
                <button
                  type="button"
                  role="switch"
                  aria-checked={q.is_active}
                  onClick={(e) => handleToggleActive(e, q.question_id, q.is_active)}
                  aria-label={`${q.is_active ? 'Désactiver' : 'Activer'} Q${q.question_number ?? ''}`}
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    q.is_active
                      ? 'text-secondary-500 hover:bg-secondary-50'
                      : 'text-neutral-400 hover:bg-neutral-100'
                  }`}
                >
                  <span className={`inline-block h-3 w-6 rounded-full ${q.is_active ? 'bg-secondary-400' : 'bg-neutral-300'}`}>
                    <span className={`mt-0.5 block h-2 w-2 rounded-full bg-white transition-transform ${q.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
