'use client';

import { X } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import DOMPurify from 'dompurify';
import { useCallback, useEffect, useRef, useState } from 'react';
import QuestionEditorForm, { type QuestionFormData } from './QuestionEditorForm';
import type { Proposition } from './PropositionEditor';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface QuestionSidePanelProps {
  questionId: string | 'new';
  onClose: () => void;
  onSaved: () => void;
}

export default function QuestionSidePanel({ questionId, onClose, onSaved }: QuestionSidePanelProps) {
  const isNew = questionId === 'new';
  const [initial, setInitial] = useState<QuestionFormData | null>(null);
  const [topics, setTopics] = useState<{ id: string; title: string; level: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: topicData } = await supabase
      .from('topics')
      .select('id, title, level')
      .order('sort_order');
    setTopics(topicData?.map((t) => ({ id: t.id, title: t.title, level: t.level })) ?? []);

    if (isNew) {
      setInitial({
        question_text: '',
        topic_id: '',
        difficulty: 'medium',
        is_active: true,
        explanation_html: '',
        propositions: [
          { label: 'A', choice_text: '', is_correct: false },
          { label: 'B', choice_text: '', is_correct: false },
          { label: 'C', choice_text: '', is_correct: false },
        ],
      });
      setLoading(false);
      return;
    }

    const { data: question, error: qError } = await supabase
      .from('questions')
      .select('id, question_text, topic_id, difficulty, is_active, explanation_html')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      setError('Question introuvable.');
      setLoading(false);
      return;
    }

    const { data: choices } = await supabase
      .from('choices')
      .select('id, label, choice_text, is_correct, sort_order')
      .eq('question_id', questionId)
      .order('sort_order');

    const props: Proposition[] = (choices ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      choice_text: c.choice_text,
      is_correct: c.is_correct,
    }));

    setInitial({
      question_text: question.question_text,
      topic_id: question.topic_id,
      difficulty: question.difficulty,
      is_active: question.is_active,
      explanation_html: question.explanation_html ?? '',
      propositions: props.length >= 2 ? props : [
        { label: 'A', choice_text: '', is_correct: false },
        { label: 'B', choice_text: '', is_correct: false },
      ],
    });
    setLoading(false);
  }, [questionId, isNew]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Escape key closes panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap: focus the panel on mount
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleSave = useCallback(async (data: QuestionFormData) => {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // Sanitize explanation HTML before saving
    const sanitizedExplanation = data.explanation_html
      ? DOMPurify.sanitize(data.explanation_html)
      : null;

    if (isNew) {
      const { data: newQ, error: iError } = await supabase
        .from('questions')
        .insert({
          question_text: data.question_text,
          topic_id: data.topic_id,
          difficulty: data.difficulty as 'easy' | 'medium' | 'hard',
          is_active: data.is_active,
          explanation_html: sanitizedExplanation,
        })
        .select('id')
        .single();

      if (iError || !newQ) {
        setError(iError?.message ?? 'Erreur lors de la création.');
        setSaving(false);
        return;
      }

      // Use atomic RPC for choices
      const choicesJson = JSON.stringify(
        data.propositions.map((p, i) => ({
          label: p.label,
          choice_text: p.choice_text,
          is_correct: p.is_correct,
          sort_order: i,
        }))
      );

      const { error: cError } = await supabase.rpc('upsert_question_choices', {
        p_question_id: newQ.id,
        p_choices: choicesJson,
      });
      if (cError) {
        setError(cError.message);
        setSaving(false);
        return;
      }

      // Audit log
      supabase.rpc('log_admin_edit', {
        p_question_id: newQ.id,
        p_field: 'question_created',
        p_old: '',
        p_new: data.question_text.slice(0, 200),
      }).then(({ error: logError }) => {
        if (logError) console.error('Failed to log admin edit:', logError.message);
      });
    } else {
      const { error: uError } = await supabase
        .from('questions')
        .update({
          question_text: data.question_text,
          topic_id: data.topic_id,
          difficulty: data.difficulty as 'easy' | 'medium' | 'hard',
          is_active: data.is_active,
          explanation_html: sanitizedExplanation,
        })
        .eq('id', questionId);

      if (uError) {
        setError(uError.message);
        setSaving(false);
        return;
      }

      // Use atomic RPC for choices (transactional delete+insert)
      const choicesJson = JSON.stringify(
        data.propositions.map((p, i) => ({
          label: p.label,
          choice_text: p.choice_text,
          is_correct: p.is_correct,
          sort_order: i,
        }))
      );

      const { error: cError } = await supabase.rpc('upsert_question_choices', {
        p_question_id: questionId,
        p_choices: choicesJson,
      });
      if (cError) {
        setError(`Erreur propositions : ${cError.message}`);
        setSaving(false);
        return;
      }

      // Audit log
      supabase.rpc('log_admin_edit', {
        p_question_id: questionId,
        p_field: 'question_updated',
        p_old: '',
        p_new: data.question_text.slice(0, 200),
      }).then(({ error: logError }) => {
        if (logError) console.error('Failed to log admin edit:', logError.message);
      });
    }

    setSaving(false);
    onSaved();
  }, [questionId, isNew, onSaved]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    setSaving(true);
    const supabase = createClient();
    // Soft-delete: set is_active = false (consistent with bulk delete)
    const { error: dError } = await supabase
      .from('questions')
      .update({ is_active: false })
      .eq('id', questionId);
    if (dError) {
      setError(dError.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }, [questionId, onSaved]);

  return (
    <div className="fixed inset-0 z-40 flex md:relative md:inset-auto md:z-auto" data-testid="side-panel" role="dialog" aria-modal="true" aria-label={isNew ? 'Nouvelle question' : 'Modifier la question'}>
      {/* Backdrop on mobile */}
      <div className="fixed inset-0 bg-black/30 md:hidden" onClick={onClose} />

      {/* Panel */}
      <div ref={panelRef} tabIndex={-1} className="relative ml-auto flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl outline-none md:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-bold text-neutral-900">
            {isNew ? 'Nouvelle question' : 'Modifier la question'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Fermer le panneau"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && <p role="alert" className="mb-4 text-sm text-error">{error}</p>}

          {loading ? (
            <div className="space-y-4">
              <div className="h-10 animate-pulse rounded bg-neutral-100" />
              <div className="h-32 animate-pulse rounded bg-neutral-100" />
              <div className="h-20 animate-pulse rounded bg-neutral-100" />
            </div>
          ) : initial ? (
            <QuestionEditorForm
              initial={initial}
              topics={topics}
              isNew={isNew}
              saving={saving}
              onSave={handleSave}
              onDelete={isNew ? undefined : async () => setShowDeleteConfirm(true)}
            />
          ) : (
            <p className="text-sm text-neutral-400">Question introuvable.</p>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Désactiver cette question"
          message="Cette question sera désactivée. Vous pourrez la retrouver via le filtre « Inactives »."
          confirmLabel="Désactiver"
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
