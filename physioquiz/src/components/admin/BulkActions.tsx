'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import UndoToast from '@/components/ui/UndoToast';
import type { AdminQuestionRow, TopicOption } from '@/types/admin';

interface BulkActionsProps {
  selectedIds: Set<string>;
  topics: TopicOption[];
  questions: AdminQuestionRow[];
  onDone: () => void;
  onClear: () => void;
}

interface PendingRevert {
  entries: { questionId: string; oldTopicId: string }[];
  destinationTopicTitle: string;
}

type ConfirmAction = 'delete' | 'hard_delete' | 'activate' | null;

const MASS_DELETE_THRESHOLD = 50;

interface UndoState {
  message: string;
  questionIds: string[];
}

export default function BulkActions({ selectedIds, topics, questions, onDone, onClear }: BulkActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [moveStep, setMoveStep] = useState<'chapter' | 'subchapter'>('chapter');
  const [pendingRevert, setPendingRevert] = useState<PendingRevert | null>(null);
  const [subchapterParent, setSubchapterParent] = useState<string | null>(null);
  const [massDeleteInput, setMassDeleteInput] = useState('');
  const moveDropdownRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const count = selectedIds.size;

  // Close move dropdown on outside click
  useEffect(() => {
    if (!showMoveDropdown) return;
    function handleClick(e: MouseEvent) {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(e.target as Node)) {
        setShowMoveDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoveDropdown]);

  const isMassDelete = count >= MASS_DELETE_THRESHOLD;

  // --- Confirm action handler ---
  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;

    // Mass delete requires typing the count
    if (confirmAction === 'delete' && isMassDelete && massDeleteInput !== String(count)) {
      return;
    }

    setLoading(true);
    setError(null);
    cancelledRef.current = false;
    const supabase = createClient();
    const ids = Array.from(selectedIds);

    if (confirmAction === 'activate') {
      const is_active = true;
      const { error: err } = await supabase
        .from('questions')
        .update({ is_active })
        .in('id', ids);
      setLoading(false);
      setConfirmAction(null);
      if (err) {
        setError(err.message);
        return;
      }
      // Log
      supabase.rpc('log_admin_edit', {
        p_question_id: null,
        p_field: 'bulk_activate',
        p_old: `${ids.length} questions`,
        p_new: 'active',
      }).then(({ error: logError }) => {
        if (logError) console.error('Failed to log bulk action:', logError.message);
      });
      onDone();
    } else if (confirmAction === 'delete') {
      // Soft-delete: set is_active = false
      const { error: err } = await supabase
        .from('questions')
        .update({ is_active: false })
        .in('id', ids);
      setLoading(false);
      setConfirmAction(null);
      setMassDeleteInput('');
      if (err) {
        setError(err.message);
        return;
      }
      supabase.rpc('log_admin_edit', {
        p_question_id: null,
        p_field: 'bulk_deactivate',
        p_old: `${ids.length} questions`,
        p_new: 'désactivées',
      }).then(({ error: logError }) => {
        if (logError) console.error('Failed to log bulk delete:', logError.message);
      });
      setUndoState({
        message: `${count} question${count > 1 ? 's' : ''} désactivée${count > 1 ? 's' : ''}`,
        questionIds: ids,
      });
      onDone();
    } else if (confirmAction === 'hard_delete') {
      // Move to trash (soft delete with deleted_at) — auto-purged after 24h
      if (isMassDelete && massDeleteInput !== String(count)) return;
      const { error: err } = await supabase
        .from('questions')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids);
      setLoading(false);
      setConfirmAction(null);
      setMassDeleteInput('');
      if (err) {
        setError(err.message);
        return;
      }
      supabase.rpc('log_admin_edit', {
        p_question_id: null,
        p_field: 'bulk_delete',
        p_old: `${ids.length} questions`,
        p_new: 'mises à la corbeille',
      }).then(({ error: logError }) => {
        if (logError) console.error('Failed to log bulk delete:', logError.message);
      });
      onDone();
    }
  }, [confirmAction, selectedIds, count, isMassDelete, massDeleteInput, onDone]);

  // --- Undo: restore is_active=true ---
  const handleUndo = useCallback(async () => {
    if (!undoState) return;
    cancelledRef.current = true;
    const supabase = createClient();
    const { error: err } = await supabase
      .from('questions')
      .update({ is_active: true })
      .in('id', undoState.questionIds);
    if (err) {
      setError(`Erreur lors de la restauration : ${err.message}`);
    }
    setUndoState(null);
    onDone();
  }, [undoState, onDone]);

  // --- On undo expiry: just dismiss the toast (questions stay is_active=false) ---
  const handleUndoExpire = useCallback(() => {
    setUndoState(null);
  }, []);

  // --- Move to chapter/sub-chapter ---
  const handleMoveTo = useCallback(async (topicId: string) => {
    setLoading(true);
    setError(null);
    setShowMoveDropdown(false);
    const supabase = createClient();
    const ids = Array.from(selectedIds);

    // Capture old topic_ids BEFORE the move (for revert + enriched log)
    const revertEntries = ids.map((id) => {
      const q = questions.find((q) => q.question_id === id);
      return { questionId: id, oldTopicId: q?.topic_id ?? '' };
    });

    const { error: err } = await supabase
      .from('questions')
      .update({ topic_id: topicId })
      .in('id', ids);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }

    // Enriched log: store question details + source topics
    const topic = topics.find((t) => t.id === topicId);
    const logPayload = JSON.stringify({
      count: ids.length,
      questions: ids.map((id) => {
        const q = questions.find((q) => q.question_id === id);
        return {
          id,
          number: q?.question_number ?? null,
          text: q?.question_text?.slice(0, 50) ?? '',
          from: q?.topic_title ?? 'inconnu',
        };
      }),
    });
    supabase.rpc('log_admin_edit', {
      p_question_id: null,
      p_field: 'bulk_move',
      p_old: logPayload,
      p_new: topic?.title ?? topicId,
    }).then(({ error: logError }) => {
      if (logError) console.error('Failed to log bulk move:', logError.message);
    });

    // Enter pending state — admin must Valider or Annuler
    setPendingRevert({
      entries: revertEntries,
      destinationTopicTitle: topic?.title ?? topicId,
    });
    onDone();
  }, [selectedIds, topics, questions, onDone]);

  // --- Valider: keep the move, dismiss bar ---
  const handleValidate = useCallback(() => {
    setPendingRevert(null);
    onClear();
  }, [onClear]);

  // --- Annuler: revert the move ---
  const handleRevert = useCallback(async () => {
    if (!pendingRevert) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Group by old topic to minimize DB calls
    const byTopic = new Map<string, string[]>();
    for (const { questionId, oldTopicId } of pendingRevert.entries) {
      if (!oldTopicId) continue;
      const list = byTopic.get(oldTopicId) ?? [];
      list.push(questionId);
      byTopic.set(oldTopicId, list);
    }

    for (const [topicId, questionIds] of Array.from(byTopic.entries())) {
      const { error: err } = await supabase
        .from('questions')
        .update({ topic_id: topicId })
        .in('id', questionIds);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }

    // Log the revert
    supabase.rpc('log_admin_edit', {
      p_question_id: null,
      p_field: 'bulk_move_revert',
      p_old: pendingRevert.destinationTopicTitle,
      p_new: `${pendingRevert.entries.length} questions restaurées`,
    }).then(({ error: logError }) => {
      if (logError) console.error('Failed to log revert:', logError.message);
    });

    setLoading(false);
    setPendingRevert(null);
    onDone();
    onClear();
  }, [pendingRevert, onDone, onClear]);

  // --- Confirm messages ---
  const getConfirmConfig = () => {
    if (confirmAction === 'activate') {
      return {
        title: 'Activer les questions',
        message: `Êtes-vous sûr de vouloir activer ${count} question${count > 1 ? 's' : ''} ?`,
        label: 'Activer',
      };
    }
    if (confirmAction === 'hard_delete') {
      return {
        title: 'Supprimer',
        message: isMassDelete
          ? `Supprimer ${count} questions ? Récupérable pendant 24h via la Corbeille.`
          : `Supprimer ${count} question${count > 1 ? 's' : ''} ? Récupérable pendant 24h via la Corbeille.`,
        label: 'Supprimer',
      };
    }
    return {
      title: 'Désactiver les questions',
      message: `${count} question${count > 1 ? 's' : ''} sera${count > 1 ? 'ont' : ''} désactivée${count > 1 ? 's' : ''} (récupérable via le filtre "Inactives").`,
      label: 'Désactiver',
    };
  };

  return (
    <>
      {/* Pending revert bar — shown after a bulk move */}
      {pendingRevert ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2" data-testid="bulk-actions">
          <span className="text-sm font-medium text-green-700">
            {pendingRevert.entries.length} question{pendingRevert.entries.length > 1 ? 's' : ''} déplacée{pendingRevert.entries.length > 1 ? 's' : ''} vers {pendingRevert.destinationTopicTitle}
          </span>
          {error && <span className="text-xs text-error">{error}</span>}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={handleRevert}
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Annuler'}
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Valider
            </button>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary-50 px-4 py-2" data-testid="bulk-actions">
        <span className="text-sm font-medium text-primary">
          {count} sélectionnée{count > 1 ? 's' : ''}
        </span>

        {error && <span className="text-xs text-error">{error}</span>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirmAction('activate')}
            disabled={loading}
            className="min-h-[44px] rounded-lg bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600 disabled:opacity-50"
          >
            Activer
          </button>
          {/* Modifier dropdown — 2-step: pick field, then pick value */}
          <div className="relative" ref={moveDropdownRef}>
            <button
              type="button"
              onClick={() => { setShowMoveDropdown(!showMoveDropdown); setMoveStep('chapter'); setSubchapterParent(null); }}
              disabled={loading || pendingRevert !== null}
              className="min-h-[44px] rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Modifier...
            </button>
            {showMoveDropdown && (
              <div className="absolute left-0 top-full z-20 mt-1 w-72 glass-card">
                {/* Step 1: Pick a chapter */}
                {moveStep === 'chapter' && (
                  <div>
                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Choisir un chapitre</p>
                    <div className="max-h-48 overflow-y-auto">
                      {topics.filter((t) => t.level === 1).map((t) => (
                        <button key={t.id} type="button" onClick={() => { setSubchapterParent(t.id); setMoveStep('subchapter'); }} className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-primary-50">{t.title}</button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Step 2: Pick a sub-chapter under the selected chapter */}
                {moveStep === 'subchapter' && subchapterParent && (
                  <div>
                    <button type="button" onClick={() => { setMoveStep('chapter'); setSubchapterParent(null); }} className="w-full border-b border-neutral-100 px-4 py-2 text-left text-xs font-medium text-neutral-400 hover:text-neutral-600">← Retour</button>
                    <div className="max-h-48 overflow-y-auto">
                      {topics.filter((t) => t.level === 2 && t.parent_id === subchapterParent).length === 0 ? (
                        <p className="px-4 py-3 text-xs text-neutral-400">Aucun sous-chapitre</p>
                      ) : (
                        topics.filter((t) => t.level === 2 && t.parent_id === subchapterParent).map((t) => (
                          <button key={t.id} type="button" onClick={() => handleMoveTo(t.id)} className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-primary-50">{t.title}</button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setConfirmAction('delete')}
            disabled={loading}
            className="min-h-[44px] rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Désactiver
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('hard_delete')}
            disabled={loading}
            className="min-h-[44px] rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>

        <button
          type="button"
          onClick={() => { onClear(); setShowMoveDropdown(false); }}
          className="ml-auto min-h-[44px] text-xs text-neutral-500 hover:text-neutral-700"
        >
          Annuler
        </button>
      </div>
      )}

      {/* Confirmation modal */}
      {confirmAction && (() => {
        const config = getConfirmConfig();
        return (
          <ConfirmModal
            title={config.title}
            message={config.message}
            confirmLabel={config.label}
            danger={confirmAction === 'delete'}
            onConfirm={handleConfirmAction}
            onCancel={() => { setConfirmAction(null); setMassDeleteInput(''); }}
          >
            {confirmAction === 'delete' && isMassDelete && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-neutral-600">
                  Tapez « {count} » pour confirmer :
                </label>
                <input
                  type="text"
                  value={massDeleteInput}
                  onChange={(e) => setMassDeleteInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-error focus:outline-none focus:ring-1 focus:ring-error"
                  placeholder={String(count)}
                  autoFocus
                />
              </div>
            )}
          </ConfirmModal>
        );
      })()}

      {/* Undo toast */}
      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={handleUndo}
          onExpire={handleUndoExpire}
          undoLabel="Restaurer"
        />
      )}
    </>
  );
}
