'use client';

import { PencilSimple } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { saveQuestionField, publishAllDrafts, getDraftCount } from '@/lib/adminAutoSave';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { AdminQuestionRow, TopicOption } from '@/types/admin';
import type { PopupRequest } from '@/components/admin/QuestionGrid';
import QuestionSidePanel from '@/components/admin/QuestionSidePanel';
import BulkActions from '@/components/admin/BulkActions';
import TopicFormModal, { type TopicFormData } from '@/components/admin/TopicFormModal';

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

function GridSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ))}
    </div>
  );
}

export default function AdminDatabasePage() {
  const searchParams = useSearchParams();
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
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived: only topics that have at least one question (for filter dropdowns + Modifier)
  const { activeChapters, activeSubchapters, activeTopics } = useMemo(() => {
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
      activeTopics: active,
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

  // Draft mode
  const [draftCount, setDraftCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Corbeille
  const [showCorbeille, setShowCorbeille] = useState(false);
  const [corbeilleCount, setCorbeilleCount] = useState(0);

  // Topic management modal
  const [topicModal, setTopicModal] = useState<{
    editId: string | null;
    initial?: TopicFormData;
  } | null>(null);
  const [topicSaving, setTopicSaving] = useState(false);

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
      p_active_filter: activeFilter || null,
      p_difficulty_filter: difficultyFilter || null,
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
    }));

    setQuestions(rows);
    setLoading(false);
    initialLoadDone.current = true;
    setError(null);
  }, [topicFilter, debouncedSearch, activeFilter, difficultyFilter]);

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

  const handlePublish = useCallback(async () => {
    setShowSyncConfirm(false);
    setPublishing(true);
    const result = await publishAllDrafts();
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
  }, [fetchQuestions, fetchTopics, refreshDraftCount]);

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
  }, [fetchTopics, refreshDraftCount, refreshCorbeilleCount]);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchQuestions();
  }, [fetchQuestions]);

  const handleRefresh = useCallback(async () => {
    setSelectedIds(new Set());
    await fetchQuestions();
    refreshDraftCount();
    refreshCorbeilleCount();
  }, [fetchQuestions, refreshDraftCount, refreshCorbeilleCount]);

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
        <div className="mx-auto max-w-full px-1 md:px-4">
          {/* Row 1 — Title */}
          <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">Base de données</h1>

          {/* Row 2 — Stats pills */}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{questions.length} questions</span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{topics.filter((t) => t.level === 1).length} chapitres</span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{topics.filter((t) => t.level === 2).length} sous-chapitres</span>
            {draftCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSyncConfirm(true)}
                disabled={publishing}
                className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-200 disabled:opacity-50"
              >
                {publishing ? 'Publication...' : `${draftCount} brouillon${draftCount !== 1 ? 's' : ''} — Synchroniser`}
              </button>
            )}
            {publishSuccess && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">{publishSuccess}</span>
            )}
          </div>

          {/* Row 3 — Filters */}
          {/* Filter row 1 — Chapitre + Sous-chapitre */}
          <div className="mt-3 flex items-center gap-2">
            <select
              value={chapterFilter}
              onChange={(e) => { setChapterFilter(e.target.value); setSubchapterFilter(''); }}
              aria-label="Filtrer par chapitre"
              className="h-9 flex-1 rounded-lg border border-neutral-300 px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les chapitres</option>
              {activeChapters.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>

            <select
              value={subchapterFilter}
              onChange={(e) => setSubchapterFilter(e.target.value)}
              aria-label="Filtrer par sous-chapitre"
              className="h-9 flex-1 rounded-lg border border-neutral-300 px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les sous-chapitres</option>
              {activeSubchapters
                .filter((t) => !chapterFilter || t.parent_id === chapterFilter)
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
            </select>
          </div>

          {/* Filter row 2 — Statut + Difficulté + Recherche */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              aria-label="Filtrer par statut"
              className="h-9 rounded-lg border border-neutral-300 px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Statut : toutes</option>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
              <option value="draft">Brouillons</option>
            </select>

            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              aria-label="Filtrer par difficulté"
              className="h-9 rounded-lg border border-neutral-300 px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Difficulté : toutes</option>
              <option value="easy">Facile</option>
              <option value="medium">Moyen</option>
              <option value="hard">Difficile</option>
            </select>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              aria-label="Rechercher une question"
              className="h-9 w-40 rounded-lg border border-neutral-300 px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {/* Topic gear icon */}
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
                className="h-9 w-9 rounded-lg border border-neutral-200 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 flex items-center justify-center"
                aria-label="Modifier ce chapitre"
                title="Modifier ce chapitre"
              >
                <PencilSimple size={14} />
              </button>
            )}

            {/* Utility actions — right-aligned */}
            <div className="ml-auto flex gap-1.5">
              <button
                type="button"
                onClick={() => setShowCorbeille(true)}
                className="h-9 rounded-lg px-2.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                Corbeille{corbeilleCount > 0 ? <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-100 px-1 text-[10px] font-semibold text-red-600">{corbeilleCount}</span> : null}
              </button>
              <button
                type="button"
                onClick={() => setShowEditLog(true)}
                className="h-9 rounded-lg px-2.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                Historique
              </button>
              <button
                type="button"
                onClick={() => setTopicModal({ editId: null })}
                className="h-9 rounded-lg px-2.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                + Chapitre
              </button>
              <button
                type="button"
                onClick={() => setPanelId('new')}
                className="h-9 rounded-lg px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary-50 hover:text-primary"
              >
                + Question
              </button>
            </div>
          </div>

          {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="mt-3">
              <BulkActions
                selectedIds={selectedIds}
                topics={activeTopics}
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
                onDataChanged={handleRefresh}
                onDraftChanged={handleDraftChanged}
                onPopupOpen={setPopup}
              />
            )}
          </div>
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
          initial={topicModal.editId ? topicModal.initial : {
            title: '',
            description: '',
            parent_id: null,
            is_active: true,
          }}
          allTopics={topics}
          onSave={handleTopicSave}
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
          message={`${draftCount} modification${draftCount !== 1 ? 's' : ''} en attente de publication.`}
          confirmLabel={publishing ? 'Publication...' : 'Publier'}
          onConfirm={handlePublish}
          onCancel={() => setShowSyncConfirm(false)}
        >
          <div className="mt-3 max-h-48 overflow-y-auto">
            <p className="mb-2 text-xs font-medium text-neutral-500">Questions modifiées :</p>
            <ul className="space-y-1">
              {questions.filter((q) => q.is_draft).map((q) => (
                <li key={q.question_id} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">
                  Q{q.question_number ?? '?'} — {q.question_text.slice(0, 60)}{q.question_text.length > 60 ? '...' : ''}
                </li>
              ))}
            </ul>
            {topics.some((t) => ('is_draft' in t)) && (
              <p className="mt-2 text-xs text-neutral-400">+ chapitres modifiés</p>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
