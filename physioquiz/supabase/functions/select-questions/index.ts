// ============================================================
// Edge Function: select-questions
// Creates a quiz session and returns questions (without answers).
//
// §5: Selection algorithm (3 modes)
// §12: Anti-cheat — NEVER return is_correct
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Scoring/selection logic (inlined from quiz-engine.ts for Deno) ---

interface QuestionStat {
  question_id: string;
  topic_id: string;
  attempts: number;
  success_rate: number;
  days_since_last: number;
  avg_confidence: number | null;
  confidence_count: number;
  last_was_false_certainty: boolean | null;
}

interface QuestionWeight {
  question_id: string;
  weight: number;
}

function calculateWeights(questions: QuestionStat[]): QuestionWeight[] {
  return questions.map((q) => {
    if (!q.attempts || q.attempts === 0) {
      return { question_id: q.question_id, weight: 0.7 };
    }

    const successRate = q.success_rate ?? 0;
    const difficulty = 1 - successRate;
    const halfLife = 5 + 3 * q.attempts * successRate;
    const daysSince = q.days_since_last ?? 0;
    const forgetting = 1 - Math.exp(-daysSince / halfLife);

    let weight: number;

    if (q.confidence_count && q.confidence_count > 0) {
      const uncertainty = 1 - (q.avg_confidence ?? 0);
      weight = 0.4 * difficulty + 0.35 * forgetting + 0.25 * uncertainty;
    } else {
      weight = 0.53 * difficulty + 0.47 * forgetting;
    }

    if (q.last_was_false_certainty) {
      weight = Math.min(weight * 1.5, 1.0);
    }

    return { question_id: q.question_id, weight };
  });
}

function weightedSampleWithoutReplacement(
  items: QuestionWeight[],
  n: number
): string[] {
  const selected: string[] = [];
  const remaining = items.map((item) => ({ ...item }));
  const count = Math.min(n, remaining.length);

  for (let i = 0; i < count; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight <= 0) {
      for (let j = 0; j < count - i && remaining.length > 0; j++) {
        const idx = Math.floor(Math.random() * remaining.length);
        selected.push(remaining[idx].question_id);
        remaining.splice(idx, 1);
      }
      break;
    }

    let random = Math.random() * totalWeight;
    let picked = false;
    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].weight;
      if (random <= 0) {
        selected.push(remaining[j].question_id);
        remaining.splice(j, 1);
        picked = true;
        break;
      }
    }
    // Floating-point fallback: if rounding prevented selection, pick last item
    if (!picked && remaining.length > 0) {
      const lastIdx = remaining.length - 1;
      selected.push(remaining[lastIdx].question_id);
      remaining.splice(lastIdx, 1);
    }
  }

  shuffleArray(selected);
  return selected;
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Auth: extract user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User-scoped client (respects RLS)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Admin client (bypasses RLS for session creation)
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
      topic_id,
      session_type,
      question_count,
      include_subtopics = false,
      time_limit_seconds,
    } = body as {
      topic_id: string;
      session_type: 'short' | 'all' | 'exam';
      question_count: number;
      include_subtopics: boolean;
      time_limit_seconds?: number;
    };

    if (!topic_id || !session_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: topic_id, session_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate question_count bounds
    if (question_count != null && (!Number.isInteger(question_count) || question_count < 1 || question_count > 500)) {
      return new Response(
        JSON.stringify({ error: 'question_count must be an integer between 1 and 500' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate time_limit_seconds bounds
    if (time_limit_seconds != null && (!Number.isInteger(time_limit_seconds) || time_limit_seconds < 30 || time_limit_seconds > 36000)) {
      return new Response(
        JSON.stringify({ error: 'time_limit_seconds must be an integer between 30 and 36000' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get topic IDs (include subtopics if requested)
    let topicIds: string[] = [topic_id];

    if (include_subtopics) {
      // Recursive CTE to get all descendant topic IDs
      const { data: subtopics, error: subtopicError } = await supabaseAdmin
        .rpc('get_subtopic_ids', { root_topic_id: topic_id });

      if (subtopicError) {
        // Fallback: query topics with parent_id (1 level deep)
        const { data: children } = await supabaseAdmin
          .from('topics')
          .select('id')
          .eq('parent_id', topic_id);
        if (children) {
          topicIds = [topic_id, ...children.map((t: { id: string }) => t.id)];
        }
      } else if (subtopics) {
        topicIds = subtopics.map((t: { id: string }) => t.id);
        if (!topicIds.includes(topic_id)) {
          topicIds.unshift(topic_id);
        }
      }
    }

    // 4. Get question stats from the view
    const { data: questionStats, error: statsError } = await supabaseAdmin
      .from('question_user_stats')
      .select('question_id, topic_id, attempts, success_rate, days_since_last, avg_confidence, confidence_count, last_was_false_certainty')
      .in('topic_id', topicIds)
      .eq('user_id', user.id);

    if (statsError) {
      console.error('Failed to fetch question stats:', statsError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch question stats' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!questionStats || questionStats.length === 0) {
      // No questions in the view means no active questions for these topics
      // Try fetching active, non-draft questions directly
      const { data: activeQuestions, error: qError } = await supabaseAdmin
        .from('questions')
        .select('id, topic_id')
        .in('topic_id', topicIds)
        .eq('is_active', true)
        .eq('is_draft', false);

      if (qError || !activeQuestions || activeQuestions.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No active questions found for this topic' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // New user with no stats — all questions get weight 0.70
      for (const q of activeQuestions) {
        questionStats.push({
          question_id: q.id,
          topic_id: q.topic_id,
          attempts: 0,
          success_rate: 0,
          days_since_last: 0,
          avg_confidence: null,
          confidence_count: 0,
          last_was_false_certainty: null,
        });
      }
    }

    // Filter out draft questions from the pool
    const poolQuestionIds = questionStats.map((q: { question_id: string }) => q.question_id);
    const { data: draftQuestions } = await supabaseAdmin
      .from('questions')
      .select('id')
      .in('id', poolQuestionIds)
      .eq('is_draft', true);
    const draftIds = new Set((draftQuestions ?? []).map((q: { id: string }) => q.id));

    const pool = (questionStats as QuestionStat[]).filter((q) => !draftIds.has(q.question_id));
    const totalAvailable = pool.length;

    if (totalAvailable === 0) {
      return new Response(
        JSON.stringify({ error: 'No active questions found for this topic' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Select questions based on session type
    let selectedIds: string[];

    if (session_type === 'short') {
      // Weighted selection (§5.1 mode 1)
      const n = Math.min(question_count || 10, totalAvailable);
      const weights = calculateWeights(pool);
      selectedIds = weightedSampleWithoutReplacement(weights, n);
    } else if (session_type === 'all') {
      // All questions, shuffled (§5.1 mode 2)
      selectedIds = pool.map((q) => q.question_id);
      shuffleArray(selectedIds);
    } else {
      // Exam: uniform random (§5.1 mode 3)
      const n = Math.min(question_count || totalAvailable, totalAvailable);
      const allIds = pool.map((q) => q.question_id);
      shuffleArray(allIds);
      selectedIds = allIds.slice(0, n);
    }

    // 6. Create session row
    const sessionInsert: Record<string, unknown> = {
      user_id: user.id,
      topic_id,
      session_type,
      question_count: selectedIds.length,
      include_subtopics,
      current_question_index: 0,
    };

    // Exam mode: store time limit for server-side enforcement (§7, §12)
    if (session_type === 'exam' && time_limit_seconds && time_limit_seconds > 0) {
      sessionInsert.time_limit_seconds = time_limit_seconds;
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert(sessionInsert)
      .select('id, started_at')
      .single();

    if (sessionError || !session) {
      console.error('Failed to create session:', sessionError?.message);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Insert session_questions (ordered list)
    const sessionQuestionRows = selectedIds.map((qId, idx) => ({
      session_id: session.id,
      question_id: qId,
      sort_order: idx,
    }));

    const { error: sqError } = await supabaseAdmin
      .from('session_questions')
      .insert(sessionQuestionRows);

    if (sqError) {
      console.error('Failed to save session questions:', sqError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to save session questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Fetch full question data + choices (WITHOUT is_correct)
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select(`
        id,
        question_number,
        question_text,
        topic_id,
        question_images (
          id,
          storage_path,
          original_name,
          sort_order
        )
      `)
      .in('id', selectedIds);

    if (questionsError || !questions) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch choices — explicitly exclude is_correct (anti-cheat §12)
    const { data: choices, error: choicesError } = await supabaseAdmin
      .from('choices')
      .select('id, question_id, label, choice_text, sort_order')
      .in('question_id', selectedIds);

    if (choicesError || !choices) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch choices' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Shuffle choices per question (§5.3 step 6)
    const choicesByQuestion: Record<string, typeof choices> = {};
    for (const choice of choices) {
      if (!choicesByQuestion[choice.question_id]) {
        choicesByQuestion[choice.question_id] = [];
      }
      choicesByQuestion[choice.question_id].push(choice);
    }
    for (const qId of Object.keys(choicesByQuestion)) {
      shuffleArray(choicesByQuestion[qId]);
      // Update sort_order to reflect shuffled order
      choicesByQuestion[qId].forEach((c, idx) => {
        c.sort_order = idx;
      });
    }

    // 9. Build response in session order
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = selectedIds
      .map((qId) => {
        const q = questionMap.get(qId);
        if (!q) return null;
        return {
          ...q,
          choices: choicesByQuestion[qId] || [],
        };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({
        session_id: session.id,
        question_count: selectedIds.length,
        questions: orderedQuestions,
        // Exam mode extras for client-side countdown
        ...(session_type === 'exam' && {
          started_at: session.started_at,
          time_limit_seconds: time_limit_seconds ?? null,
        }),
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
