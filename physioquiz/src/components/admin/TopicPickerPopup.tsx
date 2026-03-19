'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { createTopicDraft, saveQuestionTopic } from '@/lib/adminAutoSave';
import { findSimilarTopics } from '@/lib/topicDuplicateCheck';
import type { TopicOption } from '@/types/admin';

interface TopicPickerPopupProps {
  questionId: string;
  currentTopicId: string;
  level: 'chapter' | 'subchapter';
  topics: TopicOption[];
  onSaved: () => void;
  onClose: () => void;
}

export default function TopicPickerPopup({
  questionId,
  currentTopicId,
  level,
  topics,
  onSaved,
  onClose,
}: TopicPickerPopupProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Duplicate confirmation
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Current topic info
  const currentTopic = useMemo(() => topics.find((t) => t.id === currentTopicId), [topics, currentTopicId]);

  // Initialize text to current value
  useEffect(() => {
    if (level === 'chapter') {
      if (currentTopic?.parent_id) {
        const parent = topics.find((t) => t.id === currentTopic.parent_id);
        setText(parent?.title ?? currentTopic.title);
      } else {
        setText(currentTopic?.title ?? '');
      }
    } else {
      setText(currentTopic?.title ?? '');
    }
  }, [level, currentTopic, topics]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Build matching topic options
  const options = useMemo(() => {
    if (level === 'chapter') {
      return topics.filter((t) => t.level === 1);
    }
    const parentId = currentTopic?.parent_id;
    if (!parentId) return topics.filter((t) => t.level === 2);
    return topics.filter((t) => t.parent_id === parentId && t.level === 2);
  }, [topics, level, currentTopic]);

  // Filter options based on text
  const filtered = useMemo(() => {
    if (!text.trim()) return options;
    const lower = text.toLowerCase();
    return options.filter((t) => t.title.toLowerCase().includes(lower));
  }, [text, options]);

  // Is the typed text a new topic?
  const isNewTopic = useMemo(() => {
    if (!text.trim()) return false;
    return !options.some((t) => t.title.toLowerCase() === text.trim().toLowerCase());
  }, [text, options]);

  const handleSelectExisting = useCallback((topicId: string, title: string) => {
    setSelectedTopicId(topicId);
    setText(title);
    setShowDropdown(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedTopicId && !isNewTopic) {
      // Check if text matches an existing topic exactly
      const exact = options.find((t) => t.title.toLowerCase() === text.trim().toLowerCase());
      if (exact) {
        setSelectedTopicId(exact.id);
        // Save with existing topic
        await doSave(exact.id, exact.title);
        return;
      }
      return;
    }

    if (selectedTopicId) {
      const topic = topics.find((t) => t.id === selectedTopicId);
      await doSave(selectedTopicId, topic?.title ?? text);
    } else if (isNewTopic) {
      await doCreateAndSave();
    }
  }, [selectedTopicId, isNewTopic, text, options, topics]);

  const doSave = useCallback(async (newTopicId: string, newTopicTitle: string) => {
    if (newTopicId === currentTopicId) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);

    const oldTopic = topics.find((t) => t.id === currentTopicId);
    const result = await saveQuestionTopic(
      questionId,
      currentTopicId,
      newTopicId,
      oldTopic?.title ?? '',
      newTopicTitle,
    );

    setSaving(false);
    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? 'Erreur lors de l\'enregistrement.');
    }
  }, [questionId, currentTopicId, topics, onSaved, onClose]);

  const doCreateAndSave = useCallback(async () => {
    const newTitle = text.trim();
    if (!newTitle) return;

    // Check for duplicates
    const similar = findSimilarTopics(newTitle, topics);
    if (similar.length > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        setDuplicateConfirm({
          message: `Un chapitre similaire existe : « ${similar[0].title} ». Créer quand même ?`,
          onConfirm: () => { setDuplicateConfirm(null); resolve(true); },
          onCancel: () => { setDuplicateConfirm(null); resolve(false); },
        });
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    // Determine parent and level
    let parentId: string | null = null;
    let topicLevel = 1;
    if (level === 'subchapter') {
      parentId = currentTopic?.parent_id ?? currentTopicId;
      topicLevel = 2;
    }

    const createResult = await createTopicDraft(newTitle, parentId, topicLevel);
    if (!createResult.success || !createResult.topicId) {
      setSaving(false);
      setError(createResult.error ?? 'Erreur lors de la création.');
      return;
    }

    // Now assign this topic to the question
    const oldTopic = topics.find((t) => t.id === currentTopicId);
    const result = await saveQuestionTopic(
      questionId,
      currentTopicId,
      createResult.topicId,
      oldTopic?.title ?? '',
      createResult.title ?? newTitle,
    );

    setSaving(false);
    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? 'Erreur lors de l\'enregistrement.');
    }
  }, [text, topics, level, currentTopic, currentTopicId, questionId, onSaved]);

  const canSave = (selectedTopicId || isNewTopic || options.some((t) => t.title.toLowerCase() === text.trim().toLowerCase())) && !saving;

  return (
    <>
      <Modal
        onClose={onClose}
        title={level === 'chapter' ? 'Modifier le chapitre' : 'Modifier le sous-chapitre'}
        maxWidth="max-w-md"
      >
        {error && <p role="alert" className="mb-3 text-sm text-error">{error}</p>}

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSelectedTopicId(null);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={level === 'chapter' ? 'Nom du chapitre...' : 'Nom du sous-chapitre...'}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {showDropdown && (filtered.length > 0 || isNewTopic) && (
            <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto glass-card">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-primary/10 ${
                    selectedTopicId === t.id ? 'bg-primary/10 font-medium text-primary' : ''
                  }`}
                  onClick={() => handleSelectExisting(t.id, t.title)}
                >
                  {t.title}
                </button>
              ))}
              {isNewTopic && (
                <button
                  type="button"
                  className="w-full border-t border-neutral-100 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/10"
                  onClick={() => {
                    setSelectedTopicId(null);
                    setShowDropdown(false);
                  }}
                >
                  + Créer « {text.trim()} »
                </button>
              )}
            </div>
          )}
        </div>

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

      {duplicateConfirm && (
        <ConfirmModal
          title="Chapitre similaire"
          message={duplicateConfirm.message}
          confirmLabel="Créer quand même"
          onConfirm={duplicateConfirm.onConfirm}
          onCancel={duplicateConfirm.onCancel}
        />
      )}
    </>
  );
}
