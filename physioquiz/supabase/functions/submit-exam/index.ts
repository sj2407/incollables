// ============================================================
// Edge Function: submit-exam
// Batch-scores all exam answers, marks unanswered as incorrect,
// completes the session, and returns full correction.
//
// §7: Exam mode — correction at the end only
// §5bis: Partial scoring rules
// §12: Anti-cheat — is_correct only revealed AFTER submission
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

  if (incorrectSelected > 0) {
    return { is_correct: false, is_partially_correct: false, score_percent: 0 };
  }

  if (correctSelected === 0) {
    return { is_correct: false, is_partially_correct: false, score_percent: 0 };
  }

  if (correctSelected === totalCorrect) {
    return { is_correct: true, is_partially_correct: false, score_percent: 100 };
  }

  const score = Math.round((correctSelected / totalCorrect) * 1000) / 10;
  return { is_correct: false, is_partially_correct: true, score_percent: score };
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Auth
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
    const { session_id } = body as { session_id: string };

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verify session: belongs to user, is exam, not already completed
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, user_id, session_type, is_completed, question_count, started_at, time_limit_seconds')
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

    if (session.session_type !== 'exam') {
      return new Response(
        JSON.stringify({ error: 'This endpoint is only for exam sessions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.is_completed) {
      return new Response(
        JSON.stringify({ error: 'Exam is already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3b. Server-side time enforcement: allow submission but cap duration
    // (save-exam-answer already blocks late answers, so scoring is safe)
    let timeExpired = false;
    if (session.time_limit_seconds && session.started_at) {
      const elapsed = (Date.now() - new Date(session.started_at).getTime()) / 1000;
      if (elapsed > session.time_limit_seconds + 30) {
        // Grace period of 30s for network latency; beyond that, still allow
        // submission (answers were blocked by save-exam-answer) but flag it
        timeExpired = true;
      }
    }

    // 4. Get all session questions (the ordered list)
    const { data: sessionQuestions, error: sqError } = await supabaseAdmin
      .from('session_questions')
      .select('question_id, sort_order')
      .eq('session_id', session_id)
      .order('sort_order');

    if (sqError || !sessionQuestions || sessionQuestions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No questions found for this session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const questionIds = sessionQuestions.map((sq) => sq.question_id);

    // 5. Get all existing answers + their choices
    const { data: existingAnswers } = await supabaseAdmin
      .from('session_answers')
      .select('id, question_id, is_flagged')
      .eq('session_id', session_id);

    const answerMap = new Map(
      (existingAnswers ?? []).map((a) => [a.question_id, a])
    );

    // Fetch answer choices for existing answers
    const answerIds = (existingAnswers ?? []).map((a) => a.id);
    let answerChoicesMap: Map<string, string[]> = new Map();

    if (answerIds.length > 0) {
      const { data: answerChoices } = await supabaseAdmin
        .from('session_answer_choices')
        .select('session_answer_id, choice_id')
        .in('session_answer_id', answerIds);

      for (const ac of answerChoices ?? []) {
        if (!answerChoicesMap.has(ac.session_answer_id)) {
          answerChoicesMap.set(ac.session_answer_id, []);
        }
        answerChoicesMap.get(ac.session_answer_id)!.push(ac.choice_id);
      }
    }

    // 6. Fetch all choices WITH is_correct for scoring (server-side only)
    const { data: allChoicesRaw } = await supabaseAdmin
      .from('choices')
      .select('id, question_id, label, choice_text, is_correct, sort_order')
      .in('question_id', questionIds)
      .order('sort_order');

    const choicesByQuestion: Record<string, { id: string; is_correct: boolean; label: string; choice_text: string; sort_order: number }[]> = {};
    for (const c of allChoicesRaw ?? []) {
      if (!choicesByQuestion[c.question_id]) {
        choicesByQuestion[c.question_id] = [];
      }
      choicesByQuestion[c.question_id].push(c);
    }

    // 7. Fetch question data for the response
    const { data: questionsData } = await supabaseAdmin
      .from('questions')
      .select('id, question_number, question_text, explanation_html')
      .in('id', questionIds);

    const questionDataMap = new Map(
      (questionsData ?? []).map((q) => [q.id, q])
    );

    // 8. Score each question and build results
    let correctCount = 0;
    let wrongCount = 0;
    let partialCount = 0;
    let unansweredCount = 0;
    let scoreSum = 0;

    interface QuestionResult {
      question_id: string;
      question_number: number | null;
      question_text: string;
      explanation_html: string | null;
      selected_choice_ids: string[];
      correct_choice_ids: string[];
      is_correct: boolean;
      is_partially_correct: boolean;
      score_percent: number;
      is_flagged: boolean;
      is_unanswered: boolean;
      choices: { id: string; label: string; choice_text: string; is_correct: boolean; sort_order: number }[];
    }

    const results: QuestionResult[] = [];

    for (const questionId of questionIds) {
      const answer = answerMap.get(questionId);
      const choices = choicesByQuestion[questionId] ?? [];
      const qData = questionDataMap.get(questionId);
      const correctIds = choices.filter((c) => c.is_correct).map((c) => c.id);

      let selectedIds: string[] = [];
      let isFlagged = false;
      let isUnanswered = false;

      if (answer) {
        selectedIds = answerChoicesMap.get(answer.id) ?? [];
        isFlagged = answer.is_flagged;
      }

      // No answer or empty selection = unanswered = incorrect
      if (!answer || selectedIds.length === 0) {
        isUnanswered = true;
      }

      // Score the answer
      const scoring = isUnanswered
        ? { is_correct: false, is_partially_correct: false, score_percent: 0 }
        : scoreAnswer(selectedIds, choices);

      // Update the session_answer row with correct scoring
      if (answer) {
        await supabaseAdmin
          .from('session_answers')
          .update({
            is_correct: scoring.is_correct,
            is_partially_correct: scoring.is_partially_correct,
            score_percent: scoring.score_percent,
          })
          .eq('id', answer.id);
      } else {
        // Create a session_answer for unanswered questions
        await supabaseAdmin
          .from('session_answers')
          .insert({
            session_id,
            question_id: questionId,
            is_correct: false,
            is_partially_correct: false,
            score_percent: 0,
            confidence: null,
            time_spent_sec: null,
            is_flagged: false,
          });
      }

      // Tally counters
      if (scoring.is_correct) {
        correctCount++;
      } else if (scoring.is_partially_correct) {
        partialCount++;
      } else {
        wrongCount++;
        if (isUnanswered) unansweredCount++;
      }
      scoreSum += scoring.score_percent;

      results.push({
        question_id: questionId,
        question_number: qData?.question_number ?? null,
        question_text: qData?.question_text ?? '',
        explanation_html: qData?.explanation_html ?? null,
        selected_choice_ids: selectedIds,
        correct_choice_ids: correctIds,
        is_correct: scoring.is_correct,
        is_partially_correct: scoring.is_partially_correct,
        score_percent: scoring.score_percent,
        is_flagged: isFlagged,
        is_unanswered: isUnanswered,
        choices: choices.map((c) => ({
          id: c.id,
          label: c.label,
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          sort_order: c.sort_order,
        })),
      });
    }

    // 9. Complete the session
    const completedAt = new Date().toISOString();
    const startedAt = new Date(session.started_at).getTime();
    const rawDuration = Math.round((Date.now() - startedAt) / 1000);
    // Cap duration at time limit if exam expired (student may have submitted late)
    const durationSeconds = session.time_limit_seconds
      ? Math.min(rawDuration, session.time_limit_seconds)
      : rawDuration;
    const averageScore = questionIds.length > 0
      ? Math.round((scoreSum / questionIds.length) * 10) / 10
      : 0;

    const { error: completeError } = await supabaseAdmin
      .from('sessions')
      .update({
        is_completed: true,
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        score_percent: averageScore,
        correct_count: correctCount,
        wrong_count: wrongCount,
        partial_count: partialCount,
      })
      .eq('id', session_id);

    if (completeError) {
      return new Response(
        JSON.stringify({ error: 'Failed to complete exam session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Return full correction (§7.4)
    return new Response(
      JSON.stringify({
        session_id,
        score_percent: averageScore,
        duration_seconds: durationSeconds,
        time_limit_seconds: session.time_limit_seconds,
        correct_count: correctCount,
        wrong_count: wrongCount,
        partial_count: partialCount,
        unanswered_count: unansweredCount,
        question_count: questionIds.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
