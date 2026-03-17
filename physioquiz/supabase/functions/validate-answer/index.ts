// ============================================================
// Edge Function: validate-answer
// Validates a student's answer server-side and returns correction.
//
// §5bis: Partial scoring rules
// §12: Anti-cheat — is_correct only revealed AFTER validation
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Scoring logic (inlined from scoring.ts for Deno) ---

interface ScoringResult {
  is_correct: boolean;
  is_partially_correct: boolean;
  score_percent: number;
}

function scoreAnswer(
  selectedChoiceIds: string[],
  allChoices: { id: string; is_correct: boolean }[]
): ScoringResult {
  const correctChoices = allChoices.filter((c) => c.is_correct);
  const totalCorrect = correctChoices.length;
  const correctChoiceIds = new Set(correctChoices.map((c) => c.id));

  let correctSelected = 0;
  let incorrectSelected = 0;

  for (const choiceId of selectedChoiceIds) {
    if (correctChoiceIds.has(choiceId)) {
      correctSelected++;
    } else {
      incorrectSelected++;
    }
  }

  // 1 wrong checked → score = 0%
  if (incorrectSelected > 0) {
    return { is_correct: false, is_partially_correct: false, score_percent: 0 };
  }

  // Nothing selected → score = 0%
  if (correctSelected === 0) {
    return { is_correct: false, is_partially_correct: false, score_percent: 0 };
  }

  // All correct selected → 100%
  if (correctSelected === totalCorrect) {
    return { is_correct: true, is_partially_correct: false, score_percent: 100 };
  }

  // Partial: only some correct selected, no incorrect
  const score = Math.round((correctSelected / totalCorrect) * 1000) / 10;
  return { is_correct: false, is_partially_correct: true, score_percent: score };
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Auth: extract user from JWT (B5)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request body
    const body = await req.json();
    const {
      session_id,
      question_id,
      selected_choice_ids,
      confidence,
      time_spent_sec,
    } = body as {
      session_id: string;
      question_id: string;
      selected_choice_ids: string[];
      confidence: number | null;
      time_spent_sec: number | null;
    };

    if (!session_id || !question_id || !Array.isArray(selected_choice_ids)) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: session_id, question_id, selected_choice_ids',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verify session belongs to user (B5)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, user_id, question_count, correct_count, wrong_count, partial_count, is_completed, session_type, started_at, time_limit_seconds')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Session does not belong to this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.is_completed) {
      return new Response(
        JSON.stringify({ error: 'Session is already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4-7. Run independent checks in parallel for performance
    const [sqResult, existingResult, choicesResult] = await Promise.all([
      // 4. Verify question belongs to session (B5)
      supabaseAdmin
        .from('session_questions')
        .select('id')
        .eq('session_id', session_id)
        .eq('question_id', question_id)
        .single(),
      // 5. Verify question not already answered
      supabaseAdmin
        .from('session_answers')
        .select('id')
        .eq('session_id', session_id)
        .eq('question_id', question_id)
        .single(),
      // 7. Fetch choices WITH is_correct (server-side only)
      supabaseAdmin
        .from('choices')
        .select('id, label, choice_text, is_correct, sort_order')
        .eq('question_id', question_id)
        .order('sort_order'),
    ]);

    if (sqResult.error || !sqResult.data) {
      return new Response(
        JSON.stringify({ error: 'Question does not belong to this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingResult.data) {
      return new Response(
        JSON.stringify({ error: 'Question already answered in this session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Exam mode: check time limit (§12 anti-cheat)
    if (session.session_type === 'exam' && session.time_limit_seconds) {
      const startedAt = new Date(session.started_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - startedAt) / 1000;
      if (elapsedSeconds > session.time_limit_seconds) {
        return new Response(
          JSON.stringify({ error: 'Exam time has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const allChoices = choicesResult.data;
    if (choicesResult.error || !allChoices || allChoices.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch choices for this question' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7b. Validate selected_choice_ids belong to this question (QA review fix)
    const validChoiceIds = new Set(allChoices.map((c) => c.id));
    for (const choiceId of selected_choice_ids) {
      if (!validChoiceIds.has(choiceId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid choice ID: does not belong to this question' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 8. Score the answer (§5bis.2)
    const result = scoreAnswer(selected_choice_ids, allChoices);

    // 9. Insert session_answer
    const { data: sessionAnswer, error: answerError } = await supabaseAdmin
      .from('session_answers')
      .insert({
        session_id,
        question_id,
        is_correct: result.is_correct,
        is_partially_correct: result.is_partially_correct,
        score_percent: result.score_percent,
        confidence: confidence,
        time_spent_sec: time_spent_sec,
      })
      .select('id')
      .single();

    if (answerError || !sessionAnswer) {
      console.error('Failed to save answer:', answerError?.message);
      return new Response(
        JSON.stringify({ error: 'Failed to save answer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Insert session_answer_choices
    if (selected_choice_ids.length > 0) {
      const answerChoiceRows = selected_choice_ids.map((choiceId) => ({
        session_answer_id: sessionAnswer.id,
        choice_id: choiceId,
      }));

      const { error: acError } = await supabaseAdmin
        .from('session_answer_choices')
        .insert(answerChoiceRows);

      if (acError) {
        console.error('Failed to save answer choices:', acError.message);
        return new Response(
          JSON.stringify({ error: 'Failed to save answer choices' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 11. Update counters + fetch explanation in parallel
    const isWrong = !result.is_correct && !result.is_partially_correct;

    const [rpcResult, explanationResult] = await Promise.all([
      // Update session counters atomically via RPC
      supabaseAdmin.rpc('update_session_counters', {
        p_session_id: session_id,
        p_is_correct: result.is_correct,
        p_is_partially_correct: result.is_partially_correct,
        p_is_wrong: isWrong,
      }),
      // Fetch explanation for the question
      supabaseAdmin
        .from('questions')
        .select('explanation_html')
        .eq('id', question_id)
        .single(),
    ]);

    if (rpcResult.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to update session counters' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compute new counters for the response
    const newCorrectCount = session.correct_count + (result.is_correct ? 1 : 0);
    const newWrongCount = session.wrong_count + (isWrong ? 1 : 0);
    const newPartialCount = session.partial_count + (result.is_partially_correct ? 1 : 0);

    // Determine completion from counters (avoids extra COUNT query)
    const totalAnswered = newCorrectCount + newWrongCount + newPartialCount;
    const isLastQuestion = totalAnswered >= session.question_count;

    // B6: Session completion on last question
    let sessionScorePercent: number | null = null;
    let averageScore: number | null = null;
    if (isLastQuestion) {
      // Compute average score from all individual question scores
      const { data: avgData } = await supabaseAdmin
        .from('session_answers')
        .select('score_percent')
        .eq('session_id', session_id);

      if (avgData && avgData.length > 0) {
        const sum = avgData.reduce((acc, a) => acc + (a.score_percent ?? 0), 0);
        averageScore = Math.round((sum / avgData.length) * 10) / 10;
      }

      const completedAt = new Date().toISOString();
      const startedAt = new Date(session.started_at).getTime();
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
      sessionScorePercent =
        session.question_count > 0
          ? Math.round((newCorrectCount / session.question_count) * 1000) / 10
          : 0;

      // score_percent stores the average of individual question scores (includes partial scores).
      // averageScore is always available here (session_answers were just inserted).
      // sessionScorePercent (binary correct/total) is a defensive fallback only.
      const { error: completeError } = await supabaseAdmin
        .from('sessions')
        .update({
          is_completed: true,
          completed_at: completedAt,
          duration_seconds: durationSeconds,
          score_percent: averageScore ?? sessionScorePercent,
        })
        .eq('id', session_id);

      if (completeError) {
        return new Response(
          JSON.stringify({ error: 'Failed to complete session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 12. Build correction response — NOW we can reveal is_correct
    const correctChoiceIds = allChoices
      .filter((c) => c.is_correct)
      .map((c) => c.id);

    return new Response(
      JSON.stringify({
        is_correct: result.is_correct,
        is_partially_correct: result.is_partially_correct,
        score_percent: result.score_percent,
        correct_choice_ids: correctChoiceIds,
        explanation_html: explanationResult.data?.explanation_html ?? null,
        is_session_complete: isLastQuestion,
        session_stats: isLastQuestion
          ? {
              correct_count: newCorrectCount,
              wrong_count: newWrongCount,
              partial_count: newPartialCount,
              question_count: session.question_count,
              score_percent: sessionScorePercent,
              average_score: averageScore,
            }
          : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
