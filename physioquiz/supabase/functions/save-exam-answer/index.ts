// ============================================================
// Edge Function: save-exam-answer
// Saves/updates a student's answer during an exam WITHOUT scoring.
// Answers are stored for later batch scoring by submit-exam.
//
// §7: Exam mode — free navigation, answers saved as student navigates
// §12: Anti-cheat — no is_correct revealed during exam
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
    const {
      session_id,
      question_id,
      selected_choice_ids,
      is_flagged = false,
    } = body as {
      session_id: string;
      question_id: string;
      selected_choice_ids: string[];
      is_flagged: boolean;
    };

    if (!session_id || !question_id || !Array.isArray(selected_choice_ids)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: session_id, question_id, selected_choice_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verify session: belongs to user, is exam, not completed
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, user_id, session_type, is_completed, started_at, time_limit_seconds')
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

    // 4. Check time limit (§12 anti-cheat)
    if (session.time_limit_seconds) {
      const startedAt = new Date(session.started_at).getTime();
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      if (elapsedSeconds > session.time_limit_seconds) {
        return new Response(
          JSON.stringify({ error: 'Exam time has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Verify question belongs to session
    const { data: sq } = await supabaseAdmin
      .from('session_questions')
      .select('id')
      .eq('session_id', session_id)
      .eq('question_id', question_id)
      .single();

    if (!sq) {
      return new Response(
        JSON.stringify({ error: 'Question does not belong to this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Validate choice IDs belong to this question
    if (selected_choice_ids.length > 0) {
      const { data: validChoices } = await supabaseAdmin
        .from('published_choices')
        .select('id')
        .eq('question_id', question_id);

      const validIds = new Set((validChoices ?? []).map((c: { id: string }) => c.id));
      for (const cid of selected_choice_ids) {
        if (!validIds.has(cid)) {
          return new Response(
            JSON.stringify({ error: 'Invalid choice ID: does not belong to this question' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 7. Upsert: save or update the answer (exam allows changing answers)
    // First check if an answer already exists
    const { data: existing } = await supabaseAdmin
      .from('session_answers')
      .select('id')
      .eq('session_id', session_id)
      .eq('question_id', question_id)
      .single();

    if (existing) {
      // Update existing answer: update flag, delete old choices, insert new
      await supabaseAdmin
        .from('session_answers')
        .update({ is_flagged })
        .eq('id', existing.id);

      // Delete old choices
      await supabaseAdmin
        .from('session_answer_choices')
        .delete()
        .eq('session_answer_id', existing.id);

      // Insert new choices
      if (selected_choice_ids.length > 0) {
        await supabaseAdmin
          .from('session_answer_choices')
          .insert(
            selected_choice_ids.map((cid) => ({
              session_answer_id: existing.id,
              choice_id: cid,
            }))
          );
      }
    } else {
      // Insert new answer — during exam, scoring fields are placeholders
      // They will be properly set by submit-exam
      const { data: newAnswer, error: insertError } = await supabaseAdmin
        .from('session_answers')
        .insert({
          session_id,
          question_id,
          is_correct: false,
          is_partially_correct: false,
          score_percent: 0,
          confidence: null,
          time_spent_sec: null,
          is_flagged,
        })
        .select('id')
        .single();

      if (insertError || !newAnswer) {
        console.error('Failed to save answer:', insertError?.message);
        return new Response(
          JSON.stringify({ error: 'Failed to save answer' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert choices
      if (selected_choice_ids.length > 0) {
        await supabaseAdmin
          .from('session_answer_choices')
          .insert(
            selected_choice_ids.map((cid) => ({
              session_answer_id: newAnswer.id,
              choice_id: cid,
            }))
          );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
