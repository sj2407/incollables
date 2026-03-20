'use client';

import { PencilSimple, DotsThreeVertical } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { saveQuestionField, publishAllDrafts, getDraftCount } from '@/lib/adminAutoSave';
import { getMaterialDraftCount, publishMaterialDrafts, getMaterialSyncDiff } from '@/lib/adminMaterialActions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import PillToggle from '@/components/ui/PillToggle';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { AdminQuestionRow, MaterialType, TopicOption } from '@/types/admin';
import type { PopupRequest } from '@/components/admin/QuestionGrid';
import QuestionSidePanel from '@/components/admin/QuestionSidePanel';
import BulkActions from '@/components/admin/BulkActions';
import TopicFormModal, { type TopicFormData, type TopicCreateData } from '@/components/admin/TopicFormModal';

// Lazy-load MaterialList (only loaded when switching to a material tab)
const MaterialList = dynamic(() => import('@/components/admin/MaterialList'), { ssr: false });

// Lazy-load AG Grid so students never download it
const QuestionGrid = dynamic(
  () => import('@/components/admin/QuestionGrid'),
  { ssr: false, loading: () => <GridSkeleton /> }
);

// Lazy-load popup editors (admin-only)
const PropositionPopup = dynamic(() => import('@/components/admin/PropositionPopup'));
const CorrectAnswersPopup = dynamic(() => import('@/components/admin/CorrectAnswersPopup'));
const TipTapEditor = dynamic(() => import('@/components/admin/TipTapEditor'));
const EditLogPanel = dynamic(() => import('@/components/admin/EditLogPanel'));
const CorbeillePanel = dynamic(() => import('@/components/admin/CorbeillePanel'));
const TopicManagerPanel = dynamic(() => import('@/components/admin/TopicManagerPanel'));

function GridSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ))}
    </div>
  );
}

const TAB_OPTIONS = [
  { key: 'questions', label: 'Questions' },
  { key: 'cours', label: 'Cours' },
  { key: 'videos', label: 'Vidéos' },
  { key: 'fichiers', label: 'Fichiers' },
];

const TAB_TO_TYPE: Record<string, MaterialType> = {
  cours: 'resume',
  videos: 'video',
  fichiers: 'fiche',
};

export default function AdminDatabasePage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('questions');
  const [questions, setQuestions] = useState<AdminQuestionRow[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [chapterFilter, setChapterFilter] = useState<string>('');
  const [subchapterFilter, setSubchapterFilter] = useState<string>('');
  // topicFilter = most specific selection (subchapter > chapter)
  const topicFilter = subchapterFilter || chapterFilter;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived: only topics that have at least one question (for filter dropdowns + Modifier)
  const { activeChapters, activeSubchapters } = useMemo(() => {
    const topicIdsWithQuestions = new Set(questions.map((q) => q.topic_id));
    // Also include parent chapters of sub-chapters that have questions
    for (const tid of Array.from(topicIdsWithQuestions)) {
      const t = topics.find((tp) => tp.id === tid);
      if (t?.parent_id) topicIdsWithQuestions.add(t.parent_id);
    }
    const active = topics.filter((t) => topicIdsWithQuestions.has(t.id));
    return {
      activeChapters: active.filter((t) => t.level === 1),
      activeSubchapters: active.filter((t) => t.level === 2),
    };
  }, [questions, topics]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Side panel for new/edit question
  const [panelId, setPanelId] = useState<string | null>(null);

  // Handle ?edit=<id> deep link from quality alerts
  const editParam = searchParams.get('edit');
  const editParamHandled = useRef<string | null>(null);
  useEffect(() => {
    if (editParam && editParam !== editParamHandled.current) {
      editParamHandled.current = editParam;
      setPanelId(editParam);
    }
  }, [editParam]);

  // Popup editors (propositions, correct answers, explanation)
  const [popup, setPopup] = useState<PopupRequest | null>(null);

  // Edit log panel
  const [showEditLog, setShowEditLog] = useState(false);

  // Draft mode (questions)
  const [draftCount, setDraftCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Draft mode (materials) — tracked per active material tab
  const [materialDraftCount, setMaterialDraftCount] = useState(0);

  // Corbeille
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [showTopicManager, setShowTopicManager] = useState(false);
  const [corbeilleCount, setCorbeilleCount] = useState(0);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Topic management modal
  const [topicModal, setTopicModal] = useState<{
    editId: string | null;
    initial?: TopicFormData;
  } | null>(null);
  const [topicSaving, setTopicSaving] = useState(false);

  // Refresh material draft count when switching to a material tab
  const refreshMaterialDraftCount = useCallback(async () => {
    if (activeTab === 'questions') return;
    const type = TAB_TO_TYPE[activeTab];
    if (type) {
      const count = await getMaterialDraftCount(type);
      setMaterialDraftCount(count);
    }
  }, [activeTab]);

  useEffect(() => { refreshMaterialDraftCount(); }, [refreshMaterialDraftCount]);

  // Debounce search input
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const initialLoadDone = useRef(false);
  const fetchQuestions = useCallback(async () => {
    // Only show skeleton on initial load — refreshes preserve AG Grid sort/filter state
    if (!initialLoadDone.current) setLoading(true);
    const supabase = createClient();

    const { data, error: qError } = await supabase.rpc('get_admin_question_database_v2', {
      p_topic_id: topicFilter || null,
      p_search: debouncedSearch || null,
      p_active_filter: null,
      p_difficulty_filter: null,
    });

    if (qError) {
      setError(qError.message);
      setLoading(false);
      return;
    }

    const rows: AdminQuestionRow[] = (data ?? []).map((q: Record<string, unknown>) => ({
      question_id: q.question_id as string,
      question_number: q.question_number as number | null,
      question_text: q.question_text as string,
      topic_id: q.topic_id as string,
      topic_title: q.topic_title as string,
      parent_topic_title: (q.parent_topic_title as string | null) ?? null,
      difficulty: q.difficulty as AdminQuestionRow['difficulty'],
      is_active: q.is_active as boolean,
      correct_labels: (q.correct_labels as string) ?? '',
      has_explanation: (q.has_explanation as boolean) ?? false,
      explanation_html: (q.explanation_html as string | null) ?? null,
      all_choices: (q.all_choices as AdminQuestionRow['all_choices']) ?? [],
      total_attempts: Number(q.total_attempts),
      avg_score: Number(q.avg_score),
      is_draft: (q.is_draft as boolean) ?? false,
      needs_review: (q.needs_review as boolean) ?? false,
    }));

    setQuestions(rows);
    setLoading(false);
    initialLoadDone.current = true;
    setError(null);
  }, [topicFilter, debouncedSearch]);

  const fetchTopics = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('topics')
      .select('id, title, level, parent_id, description, is_active')
      .order('sort_order');
    if (data) {
      setTopics(data.map((t) => ({
        id: t.id, title: t.title, level: t.level, parent_id: t.parent_id,
        description: t.description, is_active: t.is_active,
      })));
    }
  }, []);

  const refreshDraftCount = useCallback(async () => {
    const count = await getDraftCount();
    setDraftCount(count);
  }, []);

  // Synchroniser confirmation
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncDiffList, setSyncDiffList] = useState<{ question_id: string; question_number: number | null; question_text_preview: string; needs_review: boolean }[]>([]);
  const unreviewedCount = useMemo(() => syncDiffList.filter((d) => d.needs_review).length, [syncDiffList]);

  const handlePublish = useCallback(async (force = false) => {
    setShowSyncConfirm(false);
    setPublishing(true);
    if (activeTab === 'questions') {
      const result = await publishAllDrafts(force);
      setPublishing(false);
      if (result.success) {
        const total = (result.questionCount ?? 0) + (result.topicCount ?? 0);
        setPublishSuccess(`${total} modification${total !== 1 ? 's' : ''} publiée${total !== 1 ? 's' : ''}`);
        setTimeout(() => setPublishSuccess(null), 3000);
        setDraftCount(0);
        fetchQuestions();
        fetchTopics();
      } else {
        setError(result.error ?? 'Erreur lors de la publication.');
        refreshDraftCount();
      }
    } else {
      const type = TAB_TO_TYPE[activeTab];
      const result = await publishMaterialDrafts(type, force);
      setPublishing(false);
      if (result.success) {
        setPublishSuccess(`${result.count} modification${result.count !== 1 ? 's' : ''} publiée${result.count !== 1 ? 's' : ''}`);
        setTimeout(() => setPublishSuccess(null), 3000);
        setMaterialDraftCount(0);
      }
    }
  }, [activeTab, fetchQuestions, fetchTopics, refreshDraftCount]);

  const refreshCorbeilleCount = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc('get_deleted_questions');
    setCorbeilleCount(Array.isArray(data) ? data.length : 0);
  }, []);

  useEffect(() => {
    fetchTopics();
    refreshDraftCount();
    refreshCorbeilleCount();
    // Auto-purge old trash on page load
    createClient().rpc('purge_deleted_questions').then(({ error: purgeErr }) => {
      if (purgeErr) console.error('Purge failed:', purgeErr.message);
    });
    createClient().rpc('purge_deleted_materials').then(({ error: purgeErr }) => {
      if (purgeErr) console.error('Purge materials failed:', purgeErr.message);
    });
  }, [fetchTopics, refreshDraftCount, refreshCorbeilleCount]);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchQuestions();
  }, [fetchQuestions]);

  const handleRefresh = useCallback(async () => {
    setSelectedIds(new Set());
    await fetchQuestions();
    fetchTopics();
    refreshDraftCount();
    refreshCorbeilleCount();
  }, [fetchQuestions, fetchTopics, refreshDraftCount, refreshCorbeilleCount]);

  // Lightweight refresh — only update draft count, no full data reload
  const handleDraftChanged = useCallback(() => {
    refreshDraftCount();
  }, [refreshDraftCount]);

  const handlePanelSaved = useCallback(() => {
    setPanelId(null);
    handleRefresh();
  }, [handleRefresh]);

  // Popup handlers
  const handlePopupSaved = useCallback(() => {
    setPopup(null);
    handleRefresh();
  }, [handleRefresh]);

  const handleExplanationSave = useCallback(async (html: string) => {
    if (!popup) return;
    const result = await saveQuestionField(popup.questionId, 'explanation_html', popup.data.explanation_html, html);
    if (result.success) {
      handlePopupSaved();
    } else {
      setError(result.error ?? 'Erreur lors de l\'enregistrement.');
      setPopup(null);
    }
  }, [popup, handlePopupSaved]);

  // Topic CRUD
  const handleTopicSave = useCallback(async (data: TopicFormData) => {
    setTopicSaving(true);
    const supabase = createClient();

    if (topicModal?.editId) {
      const { error: uError } = await supabase
        .from('topics')
        .update({
          title: data.title,
          description: data.description || null,
          parent_id: data.parent_id,
          is_active: data.is_active,
          level: data.parent_id ? (topics.find((t) => t.id === data.parent_id)?.level ?? 0) + 1 : 0,
        })
        .eq('id', topicModal.editId);
      if (uError) {
        setError(uError.message);
        setTopicSaving(false);
        return;
      }
    } else {
      const { error: iError } = await supabase.from('topics').insert({
        title: data.title,
        description: data.description || null,
        parent_id: data.parent_id,
        is_active: data.is_active,
        level: data.parent_id ? (topics.find((t) => t.id === data.parent_id)?.level ?? 0) + 1 : 0,
        sort_order: 999,
      });
      if (iError) {
        setError(iError.message);
        setTopicSaving(false);
        return;
      }
    }

    setTopicSaving(false);
    setTopicModal(null);
    fetchTopics();
    fetchQuestions();
  }, [topicModal, topics, fetchTopics, fetchQuestions]);

  const handleChapterCreate = useCallback(async (data: TopicCreateData) => {
    setTopicSaving(true);
    const supabase = createClient();

    // Check if chapter already exists (case-insensitive)
    const existingChapter = topics.find(
      (t) => t.level === 1 && t.title.toLowerCase() === data.chapterTitle.toLowerCase()
    );

    let chapterId: string;
    if (existingChapter) {
      chapterId = existingChapter.id;
    } else {
      const { data: inserted, error: iError } = await supabase.from('topics').insert({
        title: data.chapterTitle,
        parent_id: null,
        is_active: true,
        level: 1,
        sort_order: 999,
      }).select('id').single();
      if (iError || !inserted) {
        setError(iError?.message ?? 'Erreur lors de la création.');
        setTopicSaving(false);
        return;
      }
      chapterId = inserted.id;
    }

    // Insert sub-chapters (skip duplicates under same parent)
    for (const subTitle of data.subchapters) {
      const existingSub = topics.find(
        (t) => t.level === 2 && t.parent_id === chapterId && t.title.toLowerCase() === subTitle.toLowerCase()
      );
      if (existingSub) continue; // skip duplicate
      const { error: sError } = await supabase.from('topics').insert({
        title: subTitle,
        parent_id: chapterId,
        is_active: true,
        level: 2,
        sort_order: 999,
      });
      if (sError) {
        setError(sError.message);
        // Continue with remaining sub-chapters
      }
    }

    setTopicSaving(false);
    setTopicModal(null);
    fetchTopics();
    fetchQuestions();
  }, [topics, fetchTopics, fetchQuestions]);

  const handleTopicDelete = useCallback(async () => {
    if (!topicModal?.editId) return;
    setTopicSaving(true);
    const supabase = createClient();
    const { error: dError } = await supabase.from('topics').update({ is_active: false }).eq('id', topicModal.editId);
    if (dError) {
      setError(dError.message);
      setTopicSaving(false);
      return;
    }
    setTopicSaving(false);
    setTopicModal(null);
    fetchTopics();
    fetchQuestions();
  }, [topicModal, fetchTopics, fetchQuestions]);

  return (
    <div className={`flex h-full ${panelId ? 'gap-0' : ''}`}>
      {/* Main content */}
      <div className={`min-w-0 flex-1 ${panelId ? 'hidden md:block' : ''}`}>
        <div className="mx-auto max-w-full md:px-4">
          {/* Row 0 — Title + sync badge (adapts per tab) */}
          <div className="flex items-center gap-3">
            <h1
              className="shrink-0 text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]"
              title="Pour ajouter un chapitre ou sous-chapitre : cliquez sur « + Chapitre / Sous-chapitre ».&#10;Pour changer la classification de questions : sélectionnez-les avec les cercles, cliquez « Modifier... », choisissez le chapitre puis le sous-chapitre, et cliquez « Valider »."
            >Base de données</h1>
            {(() => {
              const isQ = activeTab === 'questions';
              const count = isQ ? draftCount : materialDraftCount;
              return (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isQ) {
                        const supabase = createClient();
                        const { data } = await supabase.rpc('get_sync_diff');
                        setSyncDiffList((data as typeof syncDiffList) ?? []);
                      } else {
                        const diff = await getMaterialSyncDiff(TAB_TO_TYPE[activeTab]);
                        setSyncDiffList(diff.map((d) => ({ question_id: d.id, question_number: null, question_text_preview: d.title, needs_review: d.needs_review })));
                      }
                      setShowSyncConfirm(true);
                    }}
                    disabled={publishing || count === 0}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      count > 0
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-neutral-100 text-neutral-400'
                    } disabled:opacity-70`}
                  >
                    {publishing ? 'Publication...' : count > 0 ? `${count} modification${count !== 1 ? 's' : ''} — Synchroniser` : 'À jour ✓'}
                  </button>
                  {publishSuccess && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">{publishSuccess}</span>
                  )}
                </>
              );
            })()}
          </div>
          {/* Tab toggle */}
          <div className="mt-2 overflow-x-auto">
            <PillToggle options={TAB_OPTIONS} active={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === 'questions' ? (
          <>
          {/* Stats + actions menu on same row */}
          <div className="mt-1 flex items-center gap-3">
            <p className="text-xs text-neutral-500">
              {questions.length} questions · {topics.filter((t) => t.level === 1).length} chapitres · {topics.filter((t) => t.level === 2).length} sous-chapitres
            </p>
            <div className="relative ml-auto flex items-center gap-1.5">
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
                  <button type="button" onClick={() => { setPanelId('new'); setShowActionsMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-medium text-primary hover:bg-white/50">
                    + Question
                  </button>
                  <button type="button" onClick={() => { setTopicModal({ editId: null }); setShowActionsMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-neutral-700 hover:bg-white/50">
                    + Chapitre / Sous-chapitre
                  </button>
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

          {/* Row 3 — Filters (single row) */}
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
              aria-label="Rechercher une question"
              className="h-7 min-w-0 flex-1 rounded-lg border border-neutral-300 px-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {chapterFilter && (
              <button
                type="button"
                onClick={() => {
                  const t = topics.find((tp) => tp.id === chapterFilter);
                  if (t) {
                    setTopicModal({
                      editId: t.id,
                      initial: {
                        title: t.title,
                        description: t.description ?? '',
                        parent_id: t.parent_id,
                        is_active: t.is_active,
                      },
                    });
                  }
                }}
                className="h-7 w-7 rounded-lg border border-neutral-200 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 flex items-center justify-center"
                aria-label="Modifier ce chapitre"
                title="Modifier ce chapitre"
              >
                <PencilSimple size={14} />
              </button>
            )}
          </div>


          {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="mt-3">
              <BulkActions
                selectedIds={selectedIds}
                topics={topics}
                questions={questions}
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
              <QuestionGrid
                questions={questions}
                topics={topics}
                selectedIds={selectedIds}
                onSelectionChanged={setSelectedIds}
                onDraftChanged={handleDraftChanged}
                onPopupOpen={setPopup}
              />
            )}
          </div>
          </>
          ) : (
            <MaterialList materialType={TAB_TO_TYPE[activeTab]} onDraftCountChanged={setMaterialDraftCount} />
          )}
        </div>
      </div>

      {/* Side panel (new or edit existing question) */}
      {panelId && (
        <QuestionSidePanel
          questionId={panelId}
          onClose={() => setPanelId(null)}
          onSaved={handlePanelSaved}
        />
      )}

      {/* Topic modal */}
      {topicModal && (
        <TopicFormModal
          editId={topicModal.editId}
          initial={topicModal.initial ?? {
            title: '',
            description: '',
            parent_id: null,
            is_active: true,
          }}
          allTopics={topics}
          onSave={handleTopicSave}
          onCreateChapter={handleChapterCreate}
          onDelete={topicModal.editId ? handleTopicDelete : undefined}
          onClose={() => setTopicModal(null)}
          saving={topicSaving}
        />
      )}

      {/* Popup editors */}
      {popup?.type === 'propositions' && (
        <PropositionPopup
          questionId={popup.questionId}
          choices={popup.data.all_choices}
          onSaved={handlePopupSaved}
          onClose={() => setPopup(null)}
        />
      )}
      {popup?.type === 'correct_answers' && popup.data.all_choices.length > 0 && (
        <CorrectAnswersPopup
          questionId={popup.questionId}
          choices={popup.data.all_choices}
          onSaved={handlePopupSaved}
          onClose={() => setPopup(null)}
        />
      )}
      {/* Edit log panel */}
      {showEditLog && (
        <EditLogPanel onClose={() => setShowEditLog(false)} />
      )}
      {/* Topic manager panel */}
      {showTopicManager && (
        <TopicManagerPanel
          onClose={() => { setShowTopicManager(false); handleRefresh(); }}
          onChanged={() => handleRefresh()}
        />
      )}
      {/* Corbeille panel */}
      {showCorbeille && (
        <CorbeillePanel
          onClose={() => setShowCorbeille(false)}
          onRestored={() => { setShowCorbeille(false); handleRefresh(); }}
        />
      )}

      {popup?.type === 'explanation' && (
        <TipTapEditor
          value={popup.data.explanation_html ?? ''}
          onSave={handleExplanationSave}
          onClose={() => setPopup(null)}
        />
      )}

      {/* Synchroniser confirmation modal */}
      {showSyncConfirm && (
        <ConfirmModal
          title="Synchroniser les brouillons"
          message={`${syncDiffList.length} modification${syncDiffList.length !== 1 ? 's' : ''} en attente de publication.`}
          confirmLabel={publishing ? 'Publication...' : unreviewedCount > 0 ? 'Publier sans les non vérifiés' : 'Publier'}
          onConfirm={() => handlePublish(false)}
          onCancel={() => setShowSyncConfirm(false)}
        >
          {unreviewedCount > 0 && (
            <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5">
              <p className="text-xs font-semibold text-orange-700">
                {unreviewedCount} élément{unreviewedCount !== 1 ? 's' : ''} non vérifié{unreviewedCount !== 1 ? 's' : ''}
              </p>
              <p className="mt-0.5 text-[11px] text-orange-600">
                Ces éléments ne seront pas publiés sauf si vous choisissez « Tout publier ».
              </p>
              <button
                type="button"
                onClick={() => handlePublish(true)}
                className="mt-2 rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-200"
              >
                Tout publier (y compris non vérifiés)
              </button>
            </div>
          )}
          <div className="mt-3 max-h-48 overflow-y-auto">
            <p className="mb-2 text-xs font-medium text-neutral-500">Éléments modifiés :</p>
            <ul className="space-y-1">
              {syncDiffList.map((q) => (
                <li key={q.question_id} className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${q.needs_review ? 'bg-orange-50 text-orange-800' : 'bg-blue-50 text-blue-800'}`}>
                  {q.question_number != null ? `Q${q.question_number} — ` : ''}{q.question_text_preview}
                  {q.needs_review && <span className="shrink-0 rounded-full bg-orange-200 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700">À vérifier</span>}
                </li>
              ))}
            </ul>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
