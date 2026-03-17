'use client';

import { createClient } from '@/lib/supabase/client';
import type { SafeChoice } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// --- Types ---

export interface ExamQuestion {
  id: string;
  question_number: number | null;
  question_text: string;
  topic_id: string;
  question_images: {
    id: string;
    storage_path: string;
    original_name: string | null;
    sort_order: number;
  }[];
  choices: SafeChoice[];
}

export interface ExamQuestionResult {
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
  choices: {
    id: string;
    label: string;
    choice_text: string;
    is_correct: boolean;
    sort_order: number;
  }[];
}

export interface ExamResults {
  session_id: string;
  score_percent: number;
  duration_seconds: number;
  time_limit_seconds: number | null;
  correct_count: number;
  wrong_count: number;
  partial_count: number;
  unanswered_count: number;
  question_count: number;
  results: ExamQuestionResult[];
}

export interface ExamState {
  sessionId: string;
  questions: ExamQuestion[];
  currentIndex: number;
  /** Map of questionId → Set of selected choice IDs */
  answersMap: Map<string, Set<string>>;
  /** Set of flagged question IDs */
  flaggedIds: Set<string>;
  isLoading: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  error: string | null;
  /** Server-side started_at for countdown */
  startedAt: string | null;
  /** Time limit in seconds (null = no limit) */
  timeLimitSeconds: number | null;
  /** Exam submitted — results available */
  examResults: ExamResults | null;
}

// --- Hook ---

export function useExam(sessionId: string) {
  const [state, setState] = useState<ExamState>({
    sessionId,
    questions: [],
    currentIndex: 0,
    answersMap: new Map(),
    flaggedIds: new Set(),
    isLoading: true,
    isSaving: false,
    isSubmitting: false,
    error: null,
    startedAt: null,
    timeLimitSeconds: null,
    examResults: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Debounce save: track which questions have pending saves
  const saveTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load exam session
  const loadSession = useCallback(async () => {
    const supabase = createClient();

    // Fetch session metadata
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('is_completed, session_type, started_at, time_limit_seconds')
      .eq('id', sessionId)
      .single();

    if (!sessionData) {
      setState((prev) => ({ ...prev, isLoading: false, error: 'Session introuvable.' }));
      return;
    }

    if (sessionData.session_type !== 'exam') {
      setState((prev) => ({ ...prev, isLoading: false, error: 'Cette session n\'est pas un examen.' }));
      return;
    }

    if (sessionData.is_completed) {
      setState((prev) => ({ ...prev, isLoading: false, error: 'Cet examen est déjà terminé.' }));
      return;
    }

    // Check if time expired
    if (sessionData.time_limit_seconds && sessionData.started_at) {
      const elapsed = (Date.now() - new Date(sessionData.started_at).getTime()) / 1000;
      if (elapsed > sessionData.time_limit_seconds) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Le temps de cet examen est écoulé.',
        }));
        return;
      }
    }

    // Fetch session questions (ordered)
    const { data: sessionQuestions } = await supabase
      .from('session_questions')
      .select('question_id, sort_order')
      .eq('session_id', sessionId)
      .order('sort_order');

    if (!sessionQuestions || sessionQuestions.length === 0) {
      setState((prev) => ({ ...prev, isLoading: false, error: 'Aucune question trouvée.' }));
      return;
    }

    const questionIds = sessionQuestions.map((sq) => sq.question_id);

    // Fetch questions + images + choices in parallel
    const [questionsResult, choicesResult, existingAnswersResult] = await Promise.all([
      supabase
        .from('questions')
        .select('id, question_number, question_text, topic_id, question_images (id, storage_path, original_name, sort_order)')
        .in('id', questionIds),
      supabase
        .from('safe_choices')
        .select('id, question_id, label, choice_text, sort_order')
        .in('question_id', questionIds),
      // Also fetch any already-saved answers (page refresh scenario)
      supabase
        .from('session_answers')
        .select('id, question_id, is_flagged')
        .eq('session_id', sessionId),
    ]);

    if (!questionsResult.data || !choicesResult.data) {
      setState((prev) => ({ ...prev, isLoading: false, error: 'Erreur de chargement.' }));
      return;
    }

    // Group choices by question
    const choicesByQuestion: Record<string, SafeChoice[]> = {};
    for (const c of choicesResult.data) {
      if (!choicesByQuestion[c.question_id]) {
        choicesByQuestion[c.question_id] = [];
      }
      choicesByQuestion[c.question_id].push(c);
    }
    for (const qId of Object.keys(choicesByQuestion)) {
      choicesByQuestion[qId].sort((a, b) => a.sort_order - b.sort_order);
    }

    // Resolve image URLs
    const storageBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question-images/`;

    // Build ordered question list
    const questionMap = new Map(questionsResult.data.map((q) => [q.id, q]));
    const orderedQuestions: ExamQuestion[] = questionIds
      .map((qId) => {
        const q = questionMap.get(qId);
        if (!q) return null;
        const images = [...(q.question_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        for (const img of images) {
          if (!img.storage_path.startsWith('http')) {
            img.storage_path = storageBaseUrl + img.storage_path;
          }
        }
        return {
          ...q,
          question_images: images,
          choices: choicesByQuestion[qId] ?? [],
        };
      })
      .filter((q): q is ExamQuestion => q !== null);

    // Restore saved answers (page refresh)
    const answersMap = new Map<string, Set<string>>();
    const flaggedIds = new Set<string>();

    if (existingAnswersResult.data && existingAnswersResult.data.length > 0) {
      const answerIds = existingAnswersResult.data.map((a) => a.id);
      const { data: savedChoices } = await supabase
        .from('session_answer_choices')
        .select('session_answer_id, choice_id')
        .in('session_answer_id', answerIds);

      // Build answer_id → question_id map
      const answerIdToQuestion = new Map(
        existingAnswersResult.data.map((a) => [a.id, a.question_id])
      );

      for (const ac of savedChoices ?? []) {
        const qId = answerIdToQuestion.get(ac.session_answer_id);
        if (qId) {
          if (!answersMap.has(qId)) answersMap.set(qId, new Set());
          answersMap.get(qId)!.add(ac.choice_id);
        }
      }

      for (const a of existingAnswersResult.data) {
        if (a.is_flagged) flaggedIds.add(a.question_id);
      }
    }

    setState((prev) => ({
      ...prev,
      questions: orderedQuestions,
      answersMap,
      flaggedIds,
      isLoading: false,
      startedAt: sessionData.started_at,
      timeLimitSeconds: sessionData.time_limit_seconds,
    }));
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // --- Save answer to server (debounced) ---

  const saveAnswer = useCallback(
    (questionId: string) => {
      // Clear any pending save for this question
      const existing = saveTimeoutRef.current.get(questionId);
      if (existing) clearTimeout(existing);

      // Debounce: save after 500ms of no changes
      const timeout = setTimeout(async () => {
        const current = stateRef.current;
        const selectedIds = current.answersMap.get(questionId);
        const isFlagged = current.flaggedIds.has(questionId);

        const supabase = createClient();
        await supabase.functions.invoke('save-exam-answer', {
          body: {
            session_id: sessionId,
            question_id: questionId,
            selected_choice_ids: selectedIds ? Array.from(selectedIds) : [],
            is_flagged: isFlagged,
          },
        });

        saveTimeoutRef.current.delete(questionId);
      }, 500);

      saveTimeoutRef.current.set(questionId, timeout);
    },
    [sessionId],
  );

  // --- Actions ---

  const toggleChoice = useCallback(
    (questionId: string, choiceId: string) => {
      setState((prev) => {
        const newMap = new Map(prev.answersMap);
        const current = new Set(newMap.get(questionId) ?? []);
        if (current.has(choiceId)) {
          current.delete(choiceId);
        } else {
          current.add(choiceId);
        }
        newMap.set(questionId, current);
        return { ...prev, answersMap: newMap };
      });
      saveAnswer(questionId);
    },
    [saveAnswer],
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      setState((prev) => {
        const newSet = new Set(prev.flaggedIds);
        if (newSet.has(questionId)) {
          newSet.delete(questionId);
        } else {
          newSet.add(questionId);
        }
        return { ...prev, flaggedIds: newSet };
      });
      saveAnswer(questionId);
    },
    [saveAnswer],
  );

  const goToQuestion = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.questions.length) return prev;
      return { ...prev, currentIndex: index };
    });
  }, []);

  const nextQuestion = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex >= prev.questions.length - 1) return prev;
      return { ...prev, currentIndex: prev.currentIndex + 1 };
    });
  }, []);

  const prevQuestion = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex <= 0) return prev;
      return { ...prev, currentIndex: prev.currentIndex - 1 };
    });
  }, []);

  const submitExam = useCallback(async () => {
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

    // Flush all pending saves before submitting
    saveTimeoutRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    saveTimeoutRef.current.clear();

    // Save only touched questions (answered or flagged) one final time
    const current = stateRef.current;
    const supabase = createClient();

    const touchedQuestions = current.questions.filter((q) => {
      const hasAnswers = (current.answersMap.get(q.id)?.size ?? 0) > 0;
      const isFlagged = current.flaggedIds.has(q.id);
      return hasAnswers || isFlagged;
    });

    const savePromises = touchedQuestions.map((q) => {
      const selectedIds = current.answersMap.get(q.id);
      const isFlagged = current.flaggedIds.has(q.id);
      return supabase.functions.invoke('save-exam-answer', {
        body: {
          session_id: sessionId,
          question_id: q.id,
          selected_choice_ids: selectedIds ? Array.from(selectedIds) : [],
          is_flagged: isFlagged,
        },
      });
    });

    await Promise.all(savePromises);

    // Now submit for scoring
    const { data, error: fnError } = await supabase.functions.invoke('submit-exam', {
      body: { session_id: sessionId },
    });

    if (fnError || !data) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: 'Erreur lors de la soumission de l\'examen.',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isSubmitting: false,
      examResults: data as ExamResults,
    }));
  }, [sessionId]);

  // --- Derived values ---

  const currentQuestion =
    state.questions.length > 0 && state.currentIndex < state.questions.length
      ? state.questions[state.currentIndex]
      : null;

  const currentSelectedIds = currentQuestion
    ? state.answersMap.get(currentQuestion.id) ?? new Set<string>()
    : new Set<string>();

  const answeredCount = state.questions.filter(
    (q) => (state.answersMap.get(q.id)?.size ?? 0) > 0,
  ).length;

  const unansweredCount = state.questions.length - answeredCount;

  const progress =
    state.questions.length > 0
      ? (answeredCount / state.questions.length) * 100
      : 0;

  // Compute remaining seconds for countdown
  let remainingSeconds: number | null = null;
  if (state.startedAt && state.timeLimitSeconds) {
    const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 1000;
    remainingSeconds = Math.max(0, state.timeLimitSeconds - elapsed);
  }

  return {
    ...state,
    currentQuestion,
    currentSelectedIds,
    answeredCount,
    unansweredCount,
    progress,
    remainingSeconds,
    toggleChoice,
    toggleFlag,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    submitExam,
  };
}
