'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDeletedMaterials, restoreMaterial } from '@/lib/adminMaterialActions';
import Modal from '@/components/ui/Modal';
import type { DeletedMaterial, MaterialType } from '@/types/admin';

interface MaterialCorbeillePanelProps {
  materialType: MaterialType;
  onClose: () => void;
  onRestored: () => void;
}

const TYPE_LABELS: Record<MaterialType, string> = {
  resume: 'cours',
  video: 'vidéos',
  fiche: 'fichiers',
};

export default function MaterialCorbeillePanel({ materialType, onClose, onRestored }: MaterialCorbeillePanelProps) {
  const [items, setItems] = useState<DeletedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    const data = await getDeletedMaterials(materialType);
    setItems(data);
    setLoading(false);
  }, [materialType]);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);

  const handleRestore = useCallback(async (id: string) => {
    setRestoring(id);
    await restoreMaterial(id);
    setRestoring(null);
    fetchDeleted();
    onRestored();
  }, [fetchDeleted, onRestored]);

  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'à l\'instant';
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `il y a ${days}j`;
  };

  return (
    <Modal onClose={onClose} title={`Corbeille ${TYPE_LABELS[materialType]} (${items.length})`} maxWidth="max-w-lg">
      {loading ? (
        <p className="text-sm text-neutral-400">Chargement...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-400">La corbeille est vide.</p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between glass-card-inner px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-800">
                  {item.title}
                </p>
                <p className="text-xs text-neutral-400">
                  {item.topic_title ?? 'Sans chapitre'} · {timeAgo(item.deleted_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(item.id)}
                disabled={restoring === item.id}
                className="ml-3 shrink-0 rounded-lg bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600 disabled:opacity-50"
              >
                {restoring === item.id ? '...' : 'Restaurer'}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-neutral-400">
        Les éléments supprimés sont automatiquement purgés après 7 jours.
      </p>
    </Modal>
  );
}
