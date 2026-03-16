'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QuestionTable, { type QuestionRow } from '@/components/admin/QuestionTable';
import QuestionSidePanel from '@/components/admin/QuestionSidePanel';
import BulkActions from '@/components/admin/BulkActions';
import TopicFormModal, { type TopicFormData } from '@/components/admin/TopicFormModal';

interface TopicOption {
  id: string;
  title: string;
  level: number;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
}

export default function AdminDatabasePage() {
  const searchParams = useSearchParams();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Side panel — open from query param if present
  const [panelId, setPanelId] = useState<string | null>(searchParams.get('edit'));

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
      setPage(0);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data, error: qError } = await supabase.rpc('get_admin_question_database', {
      p_topic_id: topicFilter || null,
      p_search: debouncedSearch || null,
      p_active_filter: activeFilter || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });

    if (qError) {
      setError(qError.message);
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setQuestions((data as any[] ?? []).map((q) => ({
      question_id: q.question_id,
      question_number: q.question_number,
      question_text: q.question_text,
      topic_id: q.topic_id,
      topic_title: q.topic_title,
      parent_topic_title: q.parent_topic_title,
      difficulty: q.difficulty,
      is_active: q.is_active,
      correct_labels: q.correct_labels ?? '',
      has_explanation: q.has_explanation ?? false,
      total_attempts: Number(q.total_attempts),
      avg_score: Number(q.avg_score),
    })));

    setLoading(false);
    setError(null);
  }, [topicFilter, debouncedSearch, activeFilter, page]);

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

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchQuestions();
  }, [fetchQuestions]);

  const handleRefresh = useCallback(() => {
    setSelectedIds(new Set());
    fetchQuestions();
  }, [fetchQuestions]);

  const handlePanelSaved = useCallback(() => {
    setPanelId(null);
    handleRefresh();
  }, [handleRefresh]);

  // Selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (questions.every((q) => selectedIds.has(q.question_id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.question_id)));
    }
  }, [questions, selectedIds]);

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
    const { error: dError } = await supabase.from('topics').delete().eq('id', topicModal.editId);
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
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]">Base de données</h1>
              <p className="mt-1 text-sm text-neutral-500">{questions.length} résultats</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTopicModal({ editId: null })}
                className="min-h-[44px] rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                + Chapitre
              </button>
              <button
                type="button"
                onClick={() => setPanelId('new')}
                className="min-h-[44px] rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                + Question
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={topicFilter}
              onChange={(e) => { setTopicFilter(e.target.value); setPage(0); }}
              aria-label="Filtrer par chapitre"
              className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les chapitres</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {'— '.repeat(t.level)}{t.title}
                </option>
              ))}
            </select>

            <select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setPage(0); }}
              aria-label="Filtrer par statut"
              className="min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Toutes</option>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
            </select>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              aria-label="Rechercher une question"
              className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:max-w-xs"
            />

            {/* Topic gear icon next to filter — edit selected topic */}
            {topicFilter && (
              <button
                type="button"
                onClick={() => {
                  const t = topics.find((tp) => tp.id === topicFilter);
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
                className="min-h-[44px] min-w-[44px] rounded-lg border border-neutral-200 px-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                aria-label="Modifier ce chapitre"
                title="Modifier ce chapitre"
              >
                ⚙
              </button>
            )}
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="mt-4">
              <BulkActions
                selectedIds={selectedIds}
                onDone={handleRefresh}
                onClear={() => setSelectedIds(new Set())}
              />
            </div>
          )}

          {/* Table */}
          <div className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
                ))}
              </div>
            ) : (
              <QuestionTable
                questions={questions}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onRowClick={(id) => setPanelId(id)}
                onRefresh={handleRefresh}
              />
            )}
          </div>

          {/* Pagination */}
          {!loading && questions.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="min-h-[44px] rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
              >
                ← Précédent
              </button>
              <span className="text-xs text-neutral-500">Page {page + 1}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={questions.length < PAGE_SIZE}
                className="min-h-[44px] rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50"
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
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
    </div>
  );
}
