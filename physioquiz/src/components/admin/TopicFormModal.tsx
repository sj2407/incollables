'use client';

import { useMemo, useState } from 'react';
import { findSimilarTopics } from '@/lib/topicDuplicateCheck';

export interface TopicFormData {
  title: string;
  description: string;
  parent_id: string | null;
  is_active: boolean;
}

export interface TopicCreateData {
  chapterTitle: string;
  subchapters: string[];
}

interface TopicOption {
  id: string;
  title: string;
  level: number;
}

interface TopicFormModalProps {
  initial?: TopicFormData;
  allTopics: TopicOption[];
  editId: string | null;
  onSave: (data: TopicFormData) => Promise<void>;
  onCreateChapter?: (data: TopicCreateData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export default function TopicFormModal({
  initial,
  allTopics,
  editId,
  onSave,
  onCreateChapter,
  onDelete,
  onClose,
  saving,
}: TopicFormModalProps) {
  const isCreate = editId === null;

  // --- Edit mode state ---
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [parentId, setParentId] = useState<string | null>(initial?.parent_id ?? null);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  // --- Create mode state ---
  const [chapterTitle, setChapterTitle] = useState('');
  const [subchapters, setSubchapters] = useState<string[]>([]);

  // --- Shared ---
  const parentOptions = allTopics.filter((t) => t.id !== editId);

  // Duplicate check for edit mode
  const similarTopics = useMemo(() => {
    const checkTitle = isCreate ? chapterTitle : title;
    if (!checkTitle.trim() || checkTitle.trim().length < 3) return [];
    const similar = findSimilarTopics(checkTitle.trim(), allTopics, editId ?? undefined);
    // Dedupe by title
    const seen = new Set<string>();
    return similar.filter((t) => {
      const norm = t.title.toLowerCase().trim();
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [isCreate, chapterTitle, title, allTopics, editId]);

  // --- Edit mode submit ---
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onSave({ title: title.trim(), description: description.trim(), parent_id: parentId, is_active: isActive });
  }

  // --- Create mode submit ---
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chapterTitle.trim() || !onCreateChapter) return;
    await onCreateChapter({
      chapterTitle: chapterTitle.trim(),
      subchapters: subchapters.map((s) => s.trim()).filter(Boolean),
    });
  }

  // --- Create mode: sub-chapter management ---
  function addSubchapter() {
    setSubchapters([...subchapters, '']);
  }
  function removeSubchapter(index: number) {
    setSubchapters(subchapters.filter((_, i) => i !== index));
  }
  function updateSubchapter(index: number, value: string) {
    setSubchapters(subchapters.map((s, i) => (i === index ? value : s)));
  }

  // ===================== EDIT MODE =====================
  if (!isCreate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
        <div className="mx-4 w-full max-w-md glass-card p-6">
          <h2 className="text-base font-bold text-neutral-900">Modifier le chapitre</h2>
          <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="topic-title" className="text-sm font-medium text-neutral-700">Titre</label>
              <input id="topic-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              {similarTopics.length > 0 && (
                <div className="mt-1.5 rounded-lg border border-warning/30 bg-amber-50 px-3 py-2 text-xs text-warning">
                  <p className="font-medium">Des chapitres similaires existent :</p>
                  <ul className="mt-1 list-inside list-disc">
                    {similarTopics.map((t) => <li key={t.id}>{t.title}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="topic-desc" className="text-sm font-medium text-neutral-700">Description</label>
              <textarea id="topic-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="topic-parent" className="text-sm font-medium text-neutral-700">Parent</label>
              <select id="topic-parent" value={parentId ?? ''} onChange={(e) => setParentId(e.target.value || null)}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Racine (aucun parent)</option>
                {parentOptions.map((t) => <option key={t.id} value={t.id}>{'— '.repeat(t.level)}{t.title}</option>)}
              </select>
            </div>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                className="h-5 w-5 rounded-md border-neutral-300 text-primary focus:ring-primary" />
              <span className="text-sm font-medium text-neutral-700">Actif</span>
            </label>
            <div className="flex gap-3 pt-2">
              {onDelete && (
                <button type="button" onClick={onDelete} disabled={saving}
                  className="min-h-[44px] rounded-2xl border border-error px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-red-50 disabled:opacity-50">
                  Supprimer
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={onClose} disabled={saving}
                className="min-h-[44px] rounded-2xl glass-btn-secondary px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100">
                Annuler
              </button>
              <button type="submit" disabled={saving || !title.trim()}
                className="min-h-[44px] rounded-2xl bg-primary glass-btn px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ===================== CREATE MODE =====================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-md glass-card p-6">
        <h2 className="text-base font-bold text-neutral-900">Nouveau chapitre / sous-chapitre</h2>

        <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
          {/* Chapter name */}
          <div>
            <label htmlFor="chapter-title" className="text-sm font-medium text-neutral-700">Chapitre</label>
            <input id="chapter-title" type="text" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)}
              required placeholder="Nom du chapitre"
              className="mt-1 min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            {similarTopics.length > 0 && (
              <div className="mt-1.5 rounded-lg border border-warning/30 bg-amber-50 px-3 py-2 text-xs text-warning">
                <p className="font-medium">Des chapitres similaires existent :</p>
                <ul className="mt-1 list-inside list-disc">
                  {similarTopics.map((t) => <li key={t.id}>{t.title}</li>)}
                </ul>
                <p className="mt-1 text-[10px]">Si le chapitre existe déjà, les sous-chapitres seront ajoutés dessous.</p>
              </div>
            )}
          </div>

          {/* Sub-chapters */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-700">Sous-chapitres</label>
              <button type="button" onClick={addSubchapter}
                className="text-xs font-medium text-primary hover:text-primary/80">
                + Ajouter
              </button>
            </div>
            {subchapters.length === 0 && (
              <p className="mt-1 text-xs text-neutral-400">Aucun sous-chapitre (optionnel)</p>
            )}
            <div className="mt-1 space-y-2">
              {subchapters.map((sub, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={sub}
                    onChange={(e) => updateSubchapter(i, e.target.value)}
                    placeholder={`Sous-chapitre ${i + 1}`}
                    className="min-h-[40px] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button type="button" onClick={() => removeSubchapter(i)}
                    className="h-10 w-10 shrink-0 rounded-lg text-neutral-400 hover:bg-red-50 hover:text-error">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="min-h-[44px] rounded-2xl glass-btn-secondary px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100">
              Annuler
            </button>
            <button type="submit" disabled={saving || !chapterTitle.trim()}
              className="min-h-[44px] rounded-2xl bg-primary glass-btn px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400">
              {saving ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
