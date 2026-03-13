// ============================================================
// PhysioQuiz — Global TypeScript types
// ============================================================

export type UserRole = 'student' | 'admin';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type SessionType = 'short' | 'all' | 'exam';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  university: string | null;
  year_of_study: number | null;
  created_at: string;
}

export interface Topic {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  level: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  children?: Topic[];
}

export interface Question {
  id: string;
  topic_id: string;
  question_number: number | null;
  question_text: string;
  explanation_html: string | null;
  difficulty: DifficultyLevel;
  is_active: boolean;
  video_url: string | null;
  video_timestamp: number | null;
  created_at: string;
  updated_at: string;
}

export interface Choice {
  id: string;
  question_id: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
  sort_order: number;
}

// Client-safe choice (without is_correct — used during quiz)
export interface SafeChoice {
  id: string;
  question_id: string;
  label: string;
  choice_text: string;
  sort_order: number;
}

export interface QuestionImage {
  id: string;
  question_id: string;
  storage_path: string;
  original_name: string | null;
  sort_order: number;
}

export interface Session {
  id: string;
  user_id: string;
  topic_id: string;
  session_type: SessionType;
  question_count: number;
  correct_count: number;
  wrong_count: number;
  partial_count: number;
  score_percent: number | null;
  duration_seconds: number | null;
  time_limit_seconds: number | null;
  include_subtopics: boolean;
  current_question_index: number;
  is_paused: boolean;
  paused_at: string | null;
  total_pause_seconds: number;
  started_at: string;
  completed_at: string | null;
  is_completed: boolean;
}

export interface SessionAnswer {
  id: string;
  session_id: string;
  question_id: string;
  is_correct: boolean;
  is_partially_correct: boolean;
  score_percent: number;
  confidence: number | null;
  time_spent_sec: number | null;
  is_flagged: boolean;
  answered_at: string;
}

export interface SessionAnswerChoice {
  id: string;
  session_answer_id: string;
  choice_id: string;
}

export interface SessionQuestion {
  id: string;
  session_id: string;
  question_id: string;
  sort_order: number;
}

// Confidence levels
export const CONFIDENCE_VALUES = {
  GUESS: 0.0,
  HESITANT: 0.5,
  SURE: 1.0,
} as const;

export type ConfidenceLevel = (typeof CONFIDENCE_VALUES)[keyof typeof CONFIDENCE_VALUES] | null;
