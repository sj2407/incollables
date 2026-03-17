'use client';

import { useMemo, useState } from 'react';
import { findSimilarTopics } from '@/lib/topicDuplicateCheck';

export interface TopicFormData {
  title: string;
  description: string;
  parent_id: string | null;
  is_active: boolean;
}

interface TopicOption {
  id: string;
  title: string;
  level: number;
}

interface TopicFormModalProps {
  initial?: TopicFormData;
  allTopics: TopicOption[];
  /** ID of the topic being edited (null for create) */
  editId: string | null;
  onSave: (data: TopicFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export default function TopicFormModal({
  initial,
  allTopics,
  editId,
  onSave,
  onDelete,
  onClose,
  saving,
}: TopicFormModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [parentId, setParentId] = useState<string | null>(initial?.parent_id ?? null);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const isCreate = editId === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onSave({ title: title.trim(), description: description.trim(), parent_id: parentId, is_active: isActive });
  }

  // Filter out self and descendants from parent options
  const parentOptions = allTopics.filter((t) => t.id !== editId);

  // Check for near-duplicate topic names
  const similarTopics = useMemo(() => {
    if (!title.trim() || title.trim().length < 3) return [];
    return findSimilarTopics(title.trim(), allTopics, editId ?? undefined);
  }, [title, allTopics, editId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-bold text-neutral-900">
          {isCreate ? 'Nouveau chapitre' : 'Modifier le chapitre'}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="topic-title" className="text-sm font-medium text-neutral-700">Titre</label>
            <input
              id="topic-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {similarTopics.length > 0 && (
              <div className="mt-1.5 rounded-lg border border-warning/30 bg-amber-50 px-3 py-2 text-xs text-warning">
                <p className="font-medium">
                  {similarTopics.length === 1
                    ? 'Un chapitre similaire existe :'
                    : 'Des chapitres similaires existent :'}
                </p>
                <ul className="mt-1 list-inside list-disc">
                  {similarTopics.map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="topic-desc" className="text-sm font-medium text-neutral-700">Description</label>
            <textarea
              id="topic-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="topic-parent" className="text-sm font-medium text-neutral-700">Parent</label>
            <select
              id="topic-parent"
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Racine (aucun parent)</option>
              {parentOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {'— '.repeat(t.level)}{t.title}
                </option>
              ))}
            </select>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-5 w-5 rounded-md border-neutral-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-neutral-700">Actif</span>
          </label>

          <div className="flex gap-3 pt-2">
            {!isCreate && onDelete && (
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
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[44px] rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {saving ? 'Enregistrement...' : isCreate ? 'Créer' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
