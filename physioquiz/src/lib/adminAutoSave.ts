import { createClient } from '@/lib/supabase/client';

type SupabaseClient = ReturnType<typeof createClient>;

interface EditLogRpcParams {
  log_admin_edit: { p_question_id: string | null; p_field: string; p_old: string; p_new: string };
  log_material_edit: { p_material_id: string | null; p_field: string; p_old: string; p_new: string };
}

/**
 * Best-effort, non-blocking audit-log write. Failures are reported to the console only.
 */
export function logEdit<R extends keyof EditLogRpcParams>(
  supabase: SupabaseClient,
  rpcName: R,
  params: EditLogRpcParams[R],
): void {
  supabase.rpc(rpcName, params).then(({ error }) => {
    if (error) console.error(`Failed to ${rpcName}:`, error.message);
  });
}

/**
 * Auto-save a single field on a question.
 * Saves to DB and logs the edit to admin_edit_log.
 */
export async function saveQuestionField(
  questionId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Map field names to DB columns
  const dbField = mapFieldToColumn(field);
  if (!dbField) {
    return { success: false, error: `Champ inconnu : ${field}` };
  }

  // Parse value for boolean fields
  let dbValue: string | boolean | null = newValue;
  if (field === 'is_active' || field === 'needs_review') {
    dbValue = newValue === 'true';
  }

  // Update the question (trigger auto-computes current_hash)
  const { error: updateError } = await supabase
    .from('questions')
    .update({ [dbField]: dbValue })
    .eq('id', questionId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Log the edit (don't block on this, but log errors)
  logEdit(supabase, 'log_admin_edit', {
    p_question_id: questionId,
    p_field: field,
    p_old: oldValue ?? '',
    p_new: newValue ?? '',
  });

  return { success: true };
}

/**
 * Save topic_id change (chapter/sub-chapter reassignment).
 */
export async function saveQuestionTopic(
  questionId: string,
  oldTopicId: string,
  newTopicId: string,
  oldTopicTitle: string,
  newTopicTitle: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('questions')
    .update({ topic_id: newTopicId })
    .eq('id', questionId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log the edit
  logEdit(supabase, 'log_admin_edit', {
    p_question_id: questionId,
    p_field: 'topic_id',
    p_old: oldTopicTitle,
    p_new: newTopicTitle,
  });

  return { success: true };
}

/**
 * Create a new topic as a draft.
 * Returns the new topic's ID and title or an error.
 */
export async function createTopicDraft(
  title: string,
  parentId: string | null,
  level: number,
): Promise<{ success: boolean; topicId?: string; title?: string; error?: string }> {
  const trimmed = title.trim();
  if (!trimmed) {
    return { success: false, error: 'Le nom du chapitre ne peut pas être vide.' };
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('topics')
    .insert({
      title: trimmed,
      parent_id: parentId,
      level,
      is_active: true,
      is_draft: true,
      sort_order: 999,
    })
    .select('id, title')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, topicId: data.id, title: data.title };
}

/**
 * Publish all changes: copies current_hash to published_hash for all questions
 * with unpublished changes. Also sets is_draft=false for backward compat.
 */
export async function publishAllDrafts(force = false): Promise<{
  success: boolean;
  questionCount?: number;
  topicCount?: number;
  error?: string;
}> {
  const supabase = createClient();
  const { data: count, error } = await supabase.rpc('publish_all_changes', { p_force: force });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, questionCount: Number(count) ?? 0, topicCount: 0 };
}

/**
 * Get the count of questions with unpublished changes (hash mismatch).
 */
export async function getDraftCount(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_unpublished_count');
  if (error) {
    console.error('getDraftCount error:', error.message);
    return 0;
  }
  return Number(data) ?? 0;
}

/** Map grid field names to database column names (allowlist) */
function mapFieldToColumn(field: string): string | null {
  const map: Record<string, string> = {
    question_text: 'question_text',
    difficulty: 'difficulty',
    is_active: 'is_active',
    needs_review: 'needs_review',
    explanation_html: 'explanation_html',
    topic_id: 'topic_id',
  };
  return map[field] ?? null;
}
