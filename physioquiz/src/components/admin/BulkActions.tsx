'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import UndoToast from '@/components/ui/UndoToast';
import type { TopicOption } from '@/types/admin';

interface BulkActionsProps {
  selectedIds: Set<string>;
  topics: TopicOption[];
  onDone: () => void;
  onClear: () => void;
}

type ConfirmAction = 'delete' | 'hard_delete' | 'activate' | null;

const MASS_DELETE_THRESHOLD = 50;

interface UndoState {
  message: string;
  questionIds: string[];
}

export default function BulkActions({ selectedIds, topics, onDone, onClear }: BulkActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [moveStep, setMoveStep] = useState<'pick' | 'chapter' | 'subchapter' | 'difficulty'>('pick');
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
        .update({ is_active, is_draft: true })
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
        .update({ is_active: false, is_draft: true })
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

  // --- Bulk change difficulty ---
  const handleBulkDifficulty = useCallback(async (difficulty: string) => {
    setLoading(true);
    setError(null);
    setShowMoveDropdown(false);
    const supabase = createClient();
    const ids = Array.from(selectedIds);
    const { error: err } = await supabase
      .from('questions')
      .update({ difficulty, is_draft: true })
      .in('id', ids);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    supabase.rpc('log_admin_edit', {
      p_question_id: null,
      p_field: 'bulk_difficulty',
      p_old: `${ids.length} questions`,
      p_new: difficulty,
    }).then(({ error: logError }) => {
      if (logError) console.error('Failed to log bulk difficulty:', logError.message);
    });
    onDone();
  }, [selectedIds, onDone]);

  // --- Move to chapter ---
  const handleMoveTo = useCallback(async (topicId: string) => {
    setLoading(true);
    setError(null);
    setShowMoveDropdown(false);
    const supabase = createClient();
    const ids = Array.from(selectedIds);
    const { error: err } = await supabase
      .from('questions')
      .update({ topic_id: topicId, is_draft: true })
      .in('id', ids);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    const topic = topics.find((t) => t.id === topicId);
    supabase.rpc('log_admin_edit', {
      p_question_id: null,
      p_field: 'bulk_move',
      p_old: `${ids.length} questions`,
      p_new: topic?.title ?? topicId,
    }).then(({ error: logError }) => {
      if (logError) console.error('Failed to log bulk move:', logError.message);
    });
    onDone();
  }, [selectedIds, topics, onDone]);

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
              onClick={() => { setShowMoveDropdown(!showMoveDropdown); setMoveStep('pick'); }}
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Modifier...
            </button>
            {showMoveDropdown && (
              <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-neutral-200 bg-white shadow-lg">
                {moveStep === 'pick' && (
                  <div className="py-1">
                    <button type="button" onClick={() => setMoveStep('chapter')} className="w-full px-4 py-2.5 text-left text-sm font-medium text-neutral-700 hover:bg-primary-50">Chapitre</button>
                    <button type="button" onClick={() => setMoveStep('subchapter')} className="w-full px-4 py-2.5 text-left text-sm font-medium text-neutral-700 hover:bg-primary-50">Sous-chapitre</button>
                    <button type="button" onClick={() => setMoveStep('difficulty')} className="w-full px-4 py-2.5 text-left text-sm font-medium text-neutral-700 hover:bg-primary-50">Difficulté</button>
                  </div>
                )}
                {moveStep === 'chapter' && (
                  <div>
                    <button type="button" onClick={() => setMoveStep('pick')} className="w-full border-b border-neutral-100 px-4 py-2 text-left text-xs font-medium text-neutral-400 hover:text-neutral-600">← Retour</button>
                    <div className="max-h-48 overflow-y-auto">
                      {topics.filter((t) => t.level === 1).map((t) => (
                        <button key={t.id} type="button" onClick={() => handleMoveTo(t.id)} className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-primary-50">{t.title}</button>
                      ))}
                    </div>
                  </div>
                )}
                {moveStep === 'subchapter' && (
                  <div>
                    <button type="button" onClick={() => setMoveStep('pick')} className="w-full border-b border-neutral-100 px-4 py-2 text-left text-xs font-medium text-neutral-400 hover:text-neutral-600">← Retour</button>
                    <div className="max-h-48 overflow-y-auto">
                      {topics.filter((t) => t.level === 2).map((t) => (
                        <button key={t.id} type="button" onClick={() => handleMoveTo(t.id)} className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-primary-50">{t.title}</button>
                      ))}
                    </div>
                  </div>
                )}
                {moveStep === 'difficulty' && (
                  <div>
                    <button type="button" onClick={() => setMoveStep('pick')} className="w-full border-b border-neutral-100 px-4 py-2 text-left text-xs font-medium text-neutral-400 hover:text-neutral-600">← Retour</button>
                    <div className="py-1">
                      {[
                        { value: 'easy', label: 'Facile', cls: 'hover:bg-green-50' },
                        { value: 'medium', label: 'Moyen', cls: 'hover:bg-amber-50' },
                        { value: 'hard', label: 'Difficile', cls: 'hover:bg-red-50' },
                      ].map((d) => (
                        <button key={d.value} type="button" onClick={() => handleBulkDifficulty(d.value)} className={`w-full px-4 py-2.5 text-left text-sm text-neutral-700 ${d.cls}`}>{d.label}</button>
                      ))}
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
