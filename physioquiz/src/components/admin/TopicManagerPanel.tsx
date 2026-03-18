'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';

interface TopicWithCount {
  id: string;
  title: string;
  level: number;
  parent_id: string | null;
  is_active: boolean;
  question_count: number;
}

interface TopicManagerPanelProps {
  onClose: () => void;
  onChanged: () => void;
}

export default function TopicManagerPanel({ onClose, onChanged }: TopicManagerPanelProps) {
  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('get_topics_with_counts');
    setTopics((data as TopicWithCount[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = useCallback(async (topicId: string) => {
    setDeleting(topicId);
    setError(null);
    const supabase = createClient();

    // Check for sessions referencing this topic (CASCADE danger)
    const { count: sessionCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', topicId);

    if ((sessionCount ?? 0) > 0) {
      setError('Ce chapitre a des sessions associées. Désactivez-le plutôt.');
      setDeleting(null);
      return;
    }

    // Safe to delete (no questions, no sessions — CASCADE won't fire)
    const { error: dErr } = await supabase.from('topics').delete().eq('id', topicId);
    setDeleting(null);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    // Remove from local state (no flash, no re-fetch)
    setTopics((prev) => prev.filter((t) => t.id !== topicId));
  }, []);

  const chapters = topics.filter((t) => t.level === 1);
  const getSubchapters = (parentId: string) => topics.filter((t) => t.level === 2 && t.parent_id === parentId);

  return (
    <Modal onClose={onClose} title="Gérer les chapitres" maxWidth="max-w-lg">
      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-400">Chargement...</p>
      ) : topics.length === 0 ? (
        <p className="text-sm text-neutral-400">Aucun chapitre.</p>
      ) : (
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {chapters.map((ch) => {
            const subs = getSubchapters(ch.id);
            return (
              <div key={ch.id} className="rounded-lg border border-neutral-200">
                {/* Chapter row */}
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-800">{ch.title}</p>
                    <p className="text-[10px] text-neutral-400">
                      {ch.question_count} question{ch.question_count !== 1 ? 's' : ''}
                      {subs.length > 0 ? ` · ${subs.length} sous-chapitre${subs.length !== 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  {ch.question_count === 0 && subs.every((s) => s.question_count === 0) ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Delete sub-chapters first, then chapter
                        (async () => {
                          for (const s of subs) await handleDelete(s.id);
                          await handleDelete(ch.id);
                        })();
                      }}
                      disabled={deleting !== null}
                      className="ml-2 shrink-0 rounded px-2 py-1 text-xs font-medium text-error hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === ch.id ? '...' : 'Supprimer'}
                    </button>
                  ) : (
                    <span className="ml-2 shrink-0 text-[10px] text-neutral-300">a des questions</span>
                  )}
                </div>
                {/* Sub-chapters */}
                {subs.length > 0 && (
                  <div className="border-t border-neutral-100">
                    {subs.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between px-3 py-1.5 pl-6">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-neutral-600">↳ {sub.title}</p>
                          <p className="text-[10px] text-neutral-400">{sub.question_count} question{sub.question_count !== 1 ? 's' : ''}</p>
                        </div>
                        {sub.question_count === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(sub.id)}
                            disabled={deleting !== null}
                            className="ml-2 shrink-0 rounded px-2 py-1 text-[10px] font-medium text-error hover:bg-red-50 disabled:opacity-50"
                          >
                            {deleting === sub.id ? '...' : 'Supprimer'}
                          </button>
                        ) : (
                          <span className="ml-2 shrink-0 text-[10px] text-neutral-300">a des questions</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
