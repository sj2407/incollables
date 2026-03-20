'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { bulkActivateMaterials, bulkMoveMaterials, softDeleteMaterials } from '@/lib/adminMaterialActions';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { AdminMaterialRow, TopicOption } from '@/types/admin';

interface MaterialBulkActionsProps {
  selectedIds: Set<string>;
  materials: AdminMaterialRow[];
  topics: TopicOption[];
  onDone: () => void;
  onClear: () => void;
}

type ConfirmAction = 'activate' | 'deactivate' | 'delete' | null;

interface PendingRevert {
  entries: { materialId: string; oldTopicId: string | null }[];
  destinationTopicTitle: string;
}

export default function MaterialBulkActions({ selectedIds, materials, topics, onDone, onClear }: MaterialBulkActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [moveStep, setMoveStep] = useState<'chapter' | 'subchapter'>('chapter');
  const [subchapterParent, setSubchapterParent] = useState<string | null>(null);
  const [pendingRevert, setPendingRevert] = useState<PendingRevert | null>(null);
  const moveDropdownRef = useRef<HTMLDivElement>(null);
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

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    setLoading(true);
    setError(null);
    const ids = Array.from(selectedIds);

    if (confirmAction === 'activate') {
      const result = await bulkActivateMaterials(ids, true);
      if (result.error) setError(result.error);
    } else if (confirmAction === 'deactivate') {
      const result = await bulkActivateMaterials(ids, false);
      if (result.error) setError(result.error);
    } else if (confirmAction === 'delete') {
      const result = await softDeleteMaterials(ids);
      if (result.error) setError(result.error);
    }

    setLoading(false);
    setConfirmAction(null);
    onDone();
  }, [confirmAction, selectedIds, onDone]);

  const handleMoveTo = useCallback(async (topicId: string) => {
    setLoading(true);
    setError(null);
    setShowMoveDropdown(false);
    const ids = Array.from(selectedIds);

    const revertEntries = ids.map((id) => {
      const m = materials.find((m) => m.id === id);
      return { materialId: id, oldTopicId: m?.topic_id ?? null };
    });

    const topic = topics.find((t) => t.id === topicId);
    const result = await bulkMoveMaterials(ids, topicId, topic?.title ?? topicId);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setPendingRevert({
      entries: revertEntries,
      destinationTopicTitle: topic?.title ?? topicId,
    });
    onDone();
  }, [selectedIds, materials, topics, onDone]);

  const handleValidate = useCallback(() => {
    setPendingRevert(null);
    onClear();
  }, [onClear]);

  const handleRevert = useCallback(async () => {
    if (!pendingRevert) return;
    setLoading(true);
    setError(null);

    // Group by old topic
    const byTopic = new Map<string, string[]>();
    for (const { materialId, oldTopicId } of pendingRevert.entries) {
      const key = oldTopicId ?? '__null__';
      const list = byTopic.get(key) ?? [];
      list.push(materialId);
      byTopic.set(key, list);
    }

    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    for (const [topicKey, materialIds] of Array.from(byTopic.entries())) {
      const topicId = topicKey === '__null__' ? null : topicKey;
      const { error: err } = await supabase
        .from('learning_materials')
        .update({ topic_id: topicId, is_draft: true })
        .in('id', materialIds);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setPendingRevert(null);
    onDone();
    onClear();
  }, [pendingRevert, onDone, onClear]);

  const getConfirmConfig = () => {
    if (confirmAction === 'activate') {
      return {
        title: 'Activer',
        message: `Activer ${count} élément${count > 1 ? 's' : ''} ?`,
        label: 'Activer',
      };
    }
    if (confirmAction === 'delete') {
      return {
        title: 'Supprimer',
        message: `Supprimer ${count} élément${count > 1 ? 's' : ''} ? Récupérable pendant 7 jours via la Corbeille.`,
        label: 'Supprimer',
      };
    }
    return {
      title: 'Désactiver',
      message: `Désactiver ${count} élément${count > 1 ? 's' : ''} ?`,
      label: 'Désactiver',
    };
  };

  return (
    <>
      {pendingRevert ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2">
          <span className="text-sm font-medium text-green-700">
            {pendingRevert.entries.length} élément{pendingRevert.entries.length > 1 ? 's' : ''} déplacé{pendingRevert.entries.length > 1 ? 's' : ''} vers {pendingRevert.destinationTopicTitle}
          </span>
          {error && <span className="text-xs text-error">{error}</span>}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={handleRevert} disabled={loading} className="min-h-[44px] rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              {loading ? '...' : 'Annuler'}
            </button>
            <button type="button" onClick={handleValidate} disabled={loading} className="min-h-[44px] rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Valider
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary-50 px-4 py-2">
          <span className="text-sm font-medium text-primary">
            {count} sélectionnée{count > 1 ? 's' : ''}
          </span>
          {error && <span className="text-xs text-error">{error}</span>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirmAction('activate')} disabled={loading} className="min-h-[44px] rounded-lg bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600 disabled:opacity-50">
              Activer
            </button>
            <div className="relative" ref={moveDropdownRef}>
              <button
                type="button"
                onClick={() => { setShowMoveDropdown(!showMoveDropdown); setMoveStep('chapter'); setSubchapterParent(null); }}
                disabled={loading}
                className="min-h-[44px] rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Modifier...
              </button>
              {showMoveDropdown && (
                <div className="absolute left-0 top-full z-20 mt-1 w-72 glass-card">
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
            <button type="button" onClick={() => setConfirmAction('deactivate')} disabled={loading} className="min-h-[44px] rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              Désactiver
            </button>
            <button type="button" onClick={() => setConfirmAction('delete')} disabled={loading} className="min-h-[44px] rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              Supprimer
            </button>
          </div>
          <button type="button" onClick={() => { onClear(); setShowMoveDropdown(false); }} className="ml-auto min-h-[44px] text-xs text-neutral-500 hover:text-neutral-700">
            Annuler
          </button>
        </div>
      )}

      {confirmAction && (() => {
        const config = getConfirmConfig();
        return (
          <ConfirmModal
            title={config.title}
            message={config.message}
            confirmLabel={config.label}
            danger={confirmAction === 'delete'}
            onConfirm={handleConfirmAction}
            onCancel={() => setConfirmAction(null)}
          />
        );
      })()}
    </>
  );
}
