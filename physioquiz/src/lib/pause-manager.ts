import { createClient } from '@/lib/supabase/client';

const ABANDONED_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Pause a training session. No-op if already paused or completed.
 * Uses conditional update (is_paused = false) to avoid race conditions.
 */
export async function pauseSession(sessionId: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  // Atomic: only update if not already paused, not completed, not exam
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ is_paused: true, paused_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('is_paused', false)
    .eq('is_completed', false)
    .neq('session_type', 'exam');

  if (updateError) {
    return { error: 'Impossible de mettre en pause.' };
  }

  // data is null if no row matched (already paused, completed, or exam) — that's a no-op
  return { error: null };
}

/**
 * Resume a paused session. Accumulates pause duration into total_pause_seconds.
 * No-op if not paused or completed.
 * Uses conditional update (is_paused = true) to avoid race conditions.
 */
export async function resumeSession(sessionId: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  // First read to get paused_at and total_pause_seconds for calculation
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('is_paused, is_completed, paused_at, total_pause_seconds')
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    return { error: 'Session introuvable.' };
  }

  if (session.is_completed || !session.is_paused) {
    return { error: null }; // no-op
  }

  if (!session.paused_at) {
    // Data integrity issue: paused without timestamp — fix by unpausing with no added time
    const { error: fixError } = await supabase
      .from('sessions')
      .update({ is_paused: false, paused_at: null })
      .eq('id', sessionId)
      .eq('is_paused', true);

    return { error: fixError ? 'Erreur de reprise.' : null };
  }

  const pausedAt = new Date(session.paused_at).getTime();
  const additionalPauseSeconds = Math.round((Date.now() - pausedAt) / 1000);
  const newTotalPause = (session.total_pause_seconds ?? 0) + additionalPauseSeconds;

  // Atomic: only update if still paused (prevents double-resume accumulation)
  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      is_paused: false,
      paused_at: null,
      total_pause_seconds: newTotalPause,
    })
    .eq('id', sessionId)
    .eq('is_paused', true);

  if (updateError) {
    return { error: 'Impossible de reprendre la session.' };
  }

  return { error: null };
}

/**
 * Check if a paused session is abandoned (paused > 7 days).
 */
export function isAbandoned(pausedAt: string | null): boolean {
  if (!pausedAt) return false;
  const elapsed = Date.now() - new Date(pausedAt).getTime();
  return elapsed > ABANDONED_THRESHOLD_MS;
}
