'use client';

import { isAbandoned, pauseSession, resumeSession } from '@/lib/pause-manager';
import { createClient } from '@/lib/supabase/client';
import type { SafeChoice, SessionType } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// --- Types ---

export interface QuizQuestion {
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

export interface CorrectionData {
  is_correct: boolean;
  is_partially_correct: boolean;
  score_percent: number;
  correct_choice_ids: string[];
  explanation_html: string | null;
  is_session_complete: boolean;
  session_stats: {
    correct_count: number;
    wrong_count: number;
    partial_count: number;
    question_count: number;
    score_percent: number;
    average_score: number | null;
  } | null;
}

export interface QuizState {
  sessionId: string;
  sessionType: SessionType | null;
  questions: QuizQuestion[];
  currentIndex: number;
  selectedChoiceIds: Set<string>;
  confidence: number | null;
  isValidated: boolean;
  correction: CorrectionData | null;
  isLoading: boolean;
  isValidating: boolean;
  isPausing: boolean;
  isPausedOnServer: boolean;
  isAbandoned: boolean;
  error: string | null;
  questionStartTime: number;
  isComplete: boolean;
  /** Base elapsed seconds for the timer hook (set on session load/resume) */
  timerBaseElapsed: number;
  /** IDs of choices crossed out by the user (elimination aid, client-only) */
  crossedOutIds: Set<string>;
}

// --- Hook ---

export function useQuiz(sessionId: string) {
  const [state, setState] = useState<QuizState>({
    sessionId,
    sessionType: null,
    questions: [],
    currentIndex: 0,
    selectedChoiceIds: new Set(),
    confidence: null,
    isValidated: false,
    correction: null,
    isLoading: true,
    isValidating: false,
    isPausing: false,
    isPausedOnServer: false,
    isAbandoned: false,
    error: null,
    questionStartTime: Date.now(),
    isComplete: false,
    timerBaseElapsed: 0,
    crossedOutIds: new Set(),
  });

  // Ref for async callbacks to read latest state
  const stateRef = useRef(state);
  stateRef.current = state;

  // Ref for quiz focus management
  const questionRef = useRef<HTMLDivElement | null>(null);

  // Debounce flag for auto-pause
  const isPausingRef = useRef(false);

  // Load session questions
  const loadSession = useCallback(async () => {
    const supabase = createClient();

    // Fetch session metadata
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('is_completed, is_paused, paused_at, session_type, started_at, total_pause_seconds')
      .eq('id', sessionId)
      .single();

    if (sessionData?.is_completed) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isComplete: true,
        sessionType: sessionData.session_type as SessionType,
      }));
      return;
    }

    const sessionType = (sessionData?.session_type ?? null) as SessionType | null;

    // If paused, check abandoned and show paused state (don't auto-resume)
    if (sessionData?.is_paused) {
      if (isAbandoned(sessionData.paused_at)) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAbandoned: true,
          isPausedOnServer: true,
          sessionType,
          error: 'Cette session a expiré (en pause depuis plus de 7 jours).',
        }));
        return;
      }

      // Resume the session (user intentionally navigated to the play page)
      const result = await resumeSession(sessionId);
      if (result.error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error,
          sessionType,
        }));
        return;
      }
    }

    // Calculate base elapsed time for timer continuity on resume
    let computedBaseElapsed = 0;
    if (sessionData?.started_at) {
      const startedAt = new Date(sessionData.started_at).getTime();
      const totalPause = sessionData.total_pause_seconds ?? 0;
      const wallClockSeconds = Math.round((Date.now() - startedAt) / 1000);
      computedBaseElapsed = Math.max(0, wallClockSeconds - totalPause);
    }

    // Fetch session questions (ordered)
    const { data: sessionQuestions, error: sqError } = await supabase
      .from('session_questions')
      .select('question_id, sort_order')
      .eq('session_id', sessionId)
      .order('sort_order');

    if (sqError || !sessionQuestions || sessionQuestions.length === 0) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Impossible de charger la session.',
        sessionType,
      }));
      return;
    }

    const questionIds = sessionQuestions.map((sq) => sq.question_id);

    // Fetch questions, choices, and answered count in PARALLEL
    // (all three only need questionIds / sessionId — no interdependencies)
    const [questionsResult, choicesResult, answeredResult] = await Promise.all([
      supabase
        .from('published_questions')
        .select(
          `id, question_number, question_text, topic_id,
          published_question_images (id, storage_path, original_name, sort_order)`,
        )
        .in('id', questionIds),
      supabase
        .from('safe_choices')
        .select('id, question_id, label, choice_text, sort_order')
        .in('question_id', questionIds),
      supabase
        .from('session_answers')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId),
    ]);

    const { data: questions, error: qError } = questionsResult;
    const { data: choices, error: cError } = choicesResult;
    const { count: answeredCount } = answeredResult;

    if (qError || !questions) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Impossible de charger les questions.',
        sessionType,
      }));
      return;
    }

    if (cError || !choices) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Impossible de charger les propositions.',
        sessionType,
      }));
      return;
    }

    // Group choices by question, pre-sorted
    const choicesByQuestion: Record<string, SafeChoice[]> = {};
    for (const c of choices) {
      if (!choicesByQuestion[c.question_id]) {
        choicesByQuestion[c.question_id] = [];
      }
      choicesByQuestion[c.question_id].push(c);
    }
    for (const qId of Object.keys(choicesByQuestion)) {
      choicesByQuestion[qId].sort((a, b) => a.sort_order - b.sort_order);
    }

    // Build ordered question list with pre-sorted images
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions: QuizQuestion[] = questionIds
      .map((qId) => {
        const q = questionMap.get(qId);
        if (!q) return null;
        const rawImages = (q as Record<string, unknown>).published_question_images ?? (q as Record<string, unknown>).question_images ?? [];
        const images = [...(rawImages as { sort_order: number }[])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        const { published_question_images: _pqi, ...rest } = q as Record<string, unknown> & typeof q;
        return {
          ...rest,
          question_images: images,
          choices: choicesByQuestion[qId] ?? [],
        } as QuizQuestion;
      })
      .filter((q): q is QuizQuestion => q !== null);

    const startIndex = Math.min(
      answeredCount ?? 0,
      orderedQuestions.length - 1,
    );

    // Resolve image URLs from Supabase Storage using a single base URL
    const storageBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question-images/`;
    for (const q of orderedQuestions) {
      for (const img of q.question_images) {
        if (!img.storage_path.startsWith('http')) {
          img.storage_path = storageBaseUrl + img.storage_path;
        }
      }
    }

    setState((prev) => ({
      ...prev,
      questions: orderedQuestions,
      currentIndex: startIndex,
      isLoading: false,
      isPausedOnServer: false,
      questionStartTime: Date.now(),
      sessionType,
      timerBaseElapsed: computedBaseElapsed,
    }));
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // --- D3: Auto-pause on visibility change (training only) ---
  const handleAutoPause = useCallback(async () => {
    const current = stateRef.current;
    if (
      current.sessionType === 'exam' ||
      current.isComplete ||
      current.isLoading ||
      current.isPausedOnServer ||
      isPausingRef.current
    ) {
      return;
    }

    isPausingRef.current = true;
    setState((prev) => ({ ...prev, isPausedOnServer: true }));
    await pauseSession(sessionId);
    isPausingRef.current = false;
  }, [sessionId]);

  const handleAutoResume = useCallback(async () => {
    const current = stateRef.current;
    if (
      current.sessionType === 'exam' ||
      current.isComplete ||
      current.isLoading ||
      !current.isPausedOnServer
    ) {
      return;
    }

    const result = await resumeSession(sessionId);
    if (!result.error) {
      // Re-fetch session to get updated total_pause_seconds for accurate timer
      const supabase = createClient();
      const { data: refreshed } = await supabase
        .from('sessions')
        .select('started_at, total_pause_seconds')
        .eq('id', sessionId)
        .single();

      let newBase = current.timerBaseElapsed;
      if (refreshed?.started_at) {
        const startedAt = new Date(refreshed.started_at).getTime();
        const totalPause = refreshed.total_pause_seconds ?? 0;
        const wallClock = Math.round((Date.now() - startedAt) / 1000);
        newBase = Math.max(0, wallClock - totalPause);
      }

      setState((prev) => ({
        ...prev,
        isPausedOnServer: false,
        timerBaseElapsed: newBase,
      }));
    }
  }, [sessionId]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAutoPause();
      } else if (document.visibilityState === 'visible') {
        handleAutoResume();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [handleAutoPause, handleAutoResume]);

  // --- Actions ---

  const toggleChoice = useCallback((choiceId: string) => {
    setState((prev) => {
      if (prev.isValidated) return prev;
      const newSet = new Set(prev.selectedChoiceIds);
      if (newSet.has(choiceId)) {
        newSet.delete(choiceId);
      } else {
        newSet.add(choiceId);
      }
      return { ...prev, selectedChoiceIds: newSet };
    });
  }, []);

  const setConfidence = useCallback((value: number | null) => {
    setState((prev) => {
      if (prev.isValidated) return prev;
      const newValue = prev.confidence === value ? null : value;
      return { ...prev, confidence: newValue };
    });
  }, []);

  const validateAnswer = useCallback(async () => {
    setState((prev) => ({ ...prev, isValidating: true, error: null }));

    const supabase = createClient();
    const currentState = stateRef.current;
    const question = currentState.questions[currentState.currentIndex];

    if (!question) {
      setState((prev) => ({
        ...prev,
        isValidating: false,
        error: 'Question introuvable.',
      }));
      return;
    }

    const timeSpent = Math.round(
      (Date.now() - currentState.questionStartTime) / 1000,
    );

    const { data, error: fnError } = await supabase.functions.invoke(
      'validate-answer',
      {
        body: {
          session_id: sessionId,
          question_id: question.id,
          selected_choice_ids: Array.from(currentState.selectedChoiceIds),
          confidence: currentState.confidence,
          time_spent_sec: timeSpent,
        },
      },
    );

    if (fnError || !data) {
      const errorMessage =
        fnError?.message ??
        (data as Record<string, string> | null)?.error ??
        'Erreur lors de la validation.';
      setState((prev) => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
      }));
      return;
    }

    const correction = data as CorrectionData;

    setState((prev) => ({
      ...prev,
      isValidated: true,
      isValidating: false,
      correction,
      isComplete: correction.is_session_complete,
    }));
  }, [sessionId]);

  const toggleCrossOut = useCallback((choiceId: string) => {
    setState((prev) => {
      if (prev.isValidated) return prev;
      const newSet = new Set(prev.crossedOutIds);
      if (newSet.has(choiceId)) {
        newSet.delete(choiceId);
      } else {
        newSet.add(choiceId);
      }
      return { ...prev, crossedOutIds: newSet };
    });
  }, []);

  const nextQuestion = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      selectedChoiceIds: new Set(),
      crossedOutIds: new Set(),
      confidence: null,
      isValidated: false,
      correction: null,
      error: null,
      questionStartTime: Date.now(),
    }));
  }, []);

  // D2: Manual pause action (training only) — returns error if pause failed
  const handlePause = useCallback(async (): Promise<{ error: string | null }> => {
    const current = stateRef.current;
    if (current.sessionType === 'exam' || current.isComplete || current.isPausing) {
      return { error: null };
    }

    setState((prev) => ({ ...prev, isPausing: true }));
    const result = await pauseSession(sessionId);
    setState((prev) => ({ ...prev, isPausing: false, isPausedOnServer: !result.error }));
    return result;
  }, [sessionId]);

  // Focus the question area after currentIndex changes (post-render)
  const prevIndexRef = useRef(state.currentIndex);
  useEffect(() => {
    if (state.currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = state.currentIndex;
      questionRef.current?.focus();
    }
  }, [state.currentIndex]);

  const currentQuestion =
    state.questions.length > 0 && state.currentIndex < state.questions.length
      ? state.questions[state.currentIndex]
      : null;

  const isSessionComplete = state.isComplete;
  const progress =
    state.questions.length > 0
      ? ((state.currentIndex + (state.isValidated ? 1 : 0)) /
          state.questions.length) *
        100
      : 0;

  const canPause = state.sessionType !== 'exam' && !state.isComplete;

  const timerRunning =
    !state.isComplete &&
    !state.isLoading &&
    !state.isPausing &&
    !state.isPausedOnServer;

  return {
    ...state,
    currentQuestion,
    isSessionComplete,
    progress,
    questionRef,
    canPause,
    timerRunning,
    toggleChoice,
    toggleCrossOut,
    setConfidence,
    validateAnswer,
    nextQuestion,
    handlePause,
  };
}
