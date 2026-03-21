'use client';

import { DotsThreeVertical } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchMaterials, getMaterialDraftCount } from '@/lib/adminMaterialActions';
import dynamic from 'next/dynamic';
import type { AdminMaterialRow, MaterialType, TopicOption } from '@/types/admin';

const MaterialBulkActions = dynamic(() => import('@/components/admin/MaterialBulkActions'));
const MaterialCorbeillePanel = dynamic(() => import('@/components/admin/MaterialCorbeillePanel'));
const MaterialEditLogPanel = dynamic(() => import('@/components/admin/MaterialEditLogPanel'));
const TopicManagerPanel = dynamic(() => import('@/components/admin/TopicManagerPanel'));
const MaterialGrid = dynamic(() => import('@/components/admin/MaterialGrid'), {
  ssr: false,
  loading: () => <GridSkeleton />,
});

const TYPE_LABELS: Record<MaterialType, { singular: string; plural: string }> = {
  resume: { singular: 'cours', plural: 'cours' },
  video: { singular: 'vidéo', plural: 'vidéos' },
  fiche: { singular: 'fichier', plural: 'fichiers' },
};

interface MaterialListProps {
  materialType: MaterialType;
  onDraftCountChanged?: (count: number) => void;
}

function GridSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ))}
    </div>
  );
}

export default function MaterialList({ materialType, onDraftCountChanged }: MaterialListProps) {
  const labels = TYPE_LABELS[materialType];
  const [materials, setMaterials] = useState<AdminMaterialRow[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [chapterFilter, setChapterFilter] = useState('');
  const [subchapterFilter, setSubchapterFilter] = useState('');
  const topicFilter = subchapterFilter || chapterFilter;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Draft count (reported to parent)
  const [, setDraftCount] = useState(0);

  // Panels
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [showEditLog, setShowEditLog] = useState(false);
  const [showTopicManager, setShowTopicManager] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [corbeilleCount, setCorbeilleCount] = useState(0);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Close actions menu on outside click
  useEffect(() => {
    if (!showActionsMenu) return;
    function handleClick(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActionsMenu]);

  // Fetch topics
  const fetchTopics = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('topics').select('id, title, level, parent_id, description, is_active').order('sort_order');
    setTopics((data as TopicOption[]) ?? []);
  }, []);

  // Fetch materials
  const initialLoadDone = useRef(false);
  const fetchData = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);
    setError(null);
    const result = await fetchMaterials(materialType, topicFilter || null, debouncedSearch || null);
    if (result.error) {
      setError(result.error);
    }
    setMaterials(result.data);
    setLoading(false);
    initialLoadDone.current = true;
  }, [materialType, topicFilter, debouncedSearch]);

  // Refresh draft count + corbeille count
  const refreshCounts = useCallback(async () => {
    const [dc, cc] = await Promise.all([
      getMaterialDraftCount(materialType),
      (async () => {
        const supabase = createClient();
        const { count } = await supabase
          .from('learning_materials')
          .select('id', { count: 'exact', head: true })
          .eq('material_type', materialType)
          .not('deleted_at', 'is', null);
        return count ?? 0;
      })(),
    ]);
    setDraftCount(dc);
    setCorbeilleCount(cc);
    onDraftCountChanged?.(dc);
  }, [materialType, onDraftCountChanged]);

  // Initial load
  useEffect(() => {
    fetchTopics();
    fetchData();
    refreshCounts();
    // Auto-purge
    createClient().rpc('purge_deleted_materials').then(({ error: purgeErr }) => {
      if (purgeErr) console.error('Purge materials failed:', purgeErr.message);
    });
  }, [fetchTopics, fetchData, refreshCounts]);

  // Refresh on filter/search change
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData();
    refreshCounts();
    setSelectedIds(new Set());
  }, [fetchData, refreshCounts]);

  const handleDraftChanged = useCallback(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Chapters with materials (for filter dropdown)
  const activeChapters = useMemo(() => {
    const topicIds = new Set(materials.map((m) => m.topic_id).filter((id): id is string => id !== null));
    const parentIds = new Set<string>();
    topicIds.forEach((tid) => {
      const t = topics.find((t) => t.id === tid);
      if (t?.parent_id) parentIds.add(t.parent_id);
      if (t?.level === 1) parentIds.add(t.id);
    });
    return topics.filter((t) => t.level === 1 && (parentIds.has(t.id) || topicIds.has(t.id)));
  }, [materials, topics]);

  const activeSubchapters = useMemo(() => {
    const topicIds = new Set(materials.map((m) => m.topic_id).filter((id): id is string => id !== null));
    return topics.filter((t) => t.level === 2 && topicIds.has(t.id));
  }, [materials, topics]);

  return (
    <>
      {/* Stats + actions on same row */}
      <div className="mt-1 flex items-center gap-3">
        <p className="text-xs text-neutral-500">
          {materials.length} {materials.length !== 1 ? labels.plural : labels.singular} · {activeChapters.length} chapitre{activeChapters.length !== 1 ? 's' : ''}
        </p>
        <div className="relative ml-auto flex items-center gap-1.5" ref={actionsMenuRef}>
          <button
            type="button"
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Plus d'actions"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
          {showActionsMenu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 glass-card py-1">
              <button type="button" onClick={() => { setShowEditLog(true); setShowActionsMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-white/50">
                Historique
              </button>
              <button type="button" onClick={() => { setShowTopicManager(true); setShowActionsMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-white/50">
                Gérer chapitres
              </button>
              <button type="button" onClick={() => { setShowCorbeille(true); setShowActionsMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-white/50">
                Corbeille{corbeilleCount > 0 ? ` (${corbeilleCount})` : ''}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="mt-3 flex items-center gap-1.5">
        <select
          value={chapterFilter}
          onChange={(e) => { setChapterFilter(e.target.value); setSubchapterFilter(''); }}
          aria-label="Filtrer par chapitre"
          className="h-7 w-28 shrink-0 truncate rounded-lg border border-neutral-300 px-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Chapitre</option>
          {activeChapters.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <select
          value={subchapterFilter}
          onChange={(e) => setSubchapterFilter(e.target.value)}
          aria-label="Filtrer par sous-chapitre"
          className="h-7 w-32 shrink-0 truncate rounded-lg border border-neutral-300 px-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Sous-chapitre</option>
          {activeSubchapters
            .filter((t) => !chapterFilter || t.parent_id === chapterFilter)
            .map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          aria-label="Rechercher"
          className="h-7 min-w-0 flex-1 rounded-lg border border-neutral-300 px-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="mt-3">
          <MaterialBulkActions
            selectedIds={selectedIds}
            materials={materials}
            topics={topics}
            onDone={handleRefresh}
            onClear={() => setSelectedIds(new Set())}
          />
        </div>
      )}

      {/* Grid */}
      <div className="mt-3">
        {loading ? (
          <GridSkeleton />
        ) : (
          <MaterialGrid
            materials={materials}
            selectedIds={selectedIds}
            onSelectionChanged={setSelectedIds}
            onDraftChanged={handleDraftChanged}
          />
        )}
      </div>

      {/* Modals */}
      {showCorbeille && (
        <MaterialCorbeillePanel
          materialType={materialType}
          onClose={() => setShowCorbeille(false)}
          onRestored={() => { setShowCorbeille(false); handleRefresh(); }}
        />
      )}
      {showEditLog && (
        <MaterialEditLogPanel onClose={() => setShowEditLog(false)} />
      )}
      {showTopicManager && (
        <TopicManagerPanel
          onClose={() => { setShowTopicManager(false); handleRefresh(); }}
          onChanged={() => handleRefresh()}
        />
      )}
    </>
  );
}
