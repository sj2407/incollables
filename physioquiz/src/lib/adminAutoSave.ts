import { createClient } from '@/lib/supabase/client';

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
  if (field === 'is_active') {
    dbValue = newValue === 'true';
  }

  // Update the question and mark as draft
  const { error: updateError } = await supabase
    .from('questions')
    .update({ [dbField]: dbValue, is_draft: true })
    .eq('id', questionId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Log the edit (don't block on this, but log errors)
  supabase.rpc('log_admin_edit', {
    p_question_id: questionId,
    p_field: field,
    p_old: oldValue ?? '',
    p_new: newValue ?? '',
  }).then(({ error: logError }) => {
    if (logError) console.error('Failed to log admin edit:', logError.message);
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
    .update({ topic_id: newTopicId, is_draft: true })
    .eq('id', questionId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log the edit
  supabase.rpc('log_admin_edit', {
    p_question_id: questionId,
    p_field: 'topic_id',
    p_old: oldTopicTitle,
    p_new: newTopicTitle,
  }).then(({ error: logError }) => {
    if (logError) console.error('Failed to log admin edit:', logError.message);
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
 * Publish all drafts (questions + topics).
 * Both updates run; if one fails, we still report partial success.
 */
export async function publishAllDrafts(): Promise<{
  success: boolean;
  questionCount?: number;
  topicCount?: number;
  error?: string;
}> {
  const supabase = createClient();

  // Count drafts first
  const [{ count: qCount }, { count: tCount }] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('is_draft', true),
    supabase.from('topics').select('id', { count: 'exact', head: true }).eq('is_draft', true),
  ]);

  // Publish both in parallel to minimize inconsistency window
  const [qResult, tResult] = await Promise.all([
    supabase.from('questions').update({ is_draft: false }).eq('is_draft', true),
    supabase.from('topics').update({ is_draft: false }).eq('is_draft', true),
  ]);

  const errors: string[] = [];
  if (qResult.error) errors.push(`Questions : ${qResult.error.message}`);
  if (tResult.error) errors.push(`Chapitres : ${tResult.error.message}`);

  if (errors.length > 0) {
    return { success: false, error: errors.join(' / ') };
  }

  return {
    success: true,
    questionCount: qCount ?? 0,
    topicCount: tCount ?? 0,
  };
}

/**
 * Get the count of draft items (for the badge).
 */
export async function getDraftCount(): Promise<number> {
  const supabase = createClient();

  const { count: qCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_draft', true);

  const { count: tCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('is_draft', true);

  return (qCount ?? 0) + (tCount ?? 0);
}

/** Map grid field names to database column names (allowlist) */
function mapFieldToColumn(field: string): string | null {
  const map: Record<string, string> = {
    question_text: 'question_text',
    difficulty: 'difficulty',
    is_active: 'is_active',
    explanation_html: 'explanation_html',
    topic_id: 'topic_id',
  };
  return map[field] ?? null;
}
