// ============================================================
// PhysioQuiz — Admin-specific TypeScript types
// ============================================================

import type { DifficultyLevel } from './index';

/** Single choice within a question (returned by v2 RPC as JSON) */
export interface ChoiceData {
  id: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
}

/** Row returned by get_admin_question_database_v2 RPC */
export interface AdminQuestionRow {
  question_id: string;
  question_number: number | null;
  question_text: string;
  topic_id: string;
  topic_title: string;
  parent_topic_title: string | null;
  difficulty: DifficultyLevel;
  is_active: boolean;
  correct_labels: string;
  has_explanation: boolean;
  explanation_html: string | null;
  all_choices: ChoiceData[];
  total_attempts: number;
  avg_score: number;
  is_draft: boolean;
}

/** Row from admin_edit_log table */
export interface EditLogEntry {
  id: string;
  admin_id: string;
  question_id: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

/** Topic option for dropdowns (used in grid cell editors) */
export interface TopicOption {
  id: string;
  title: string;
  level: number;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
}

/** Dashboard stats returned by get_admin_dashboard_stats RPC */
export interface AdminDashboardStats {
  total_questions: number;
  total_active_questions: number;
  total_chapters: number;
  registered_students: number;
  sessions_this_week: number;
  sessions_prev_week: number;
}

/** Quality alert returned by get_admin_quality_alerts RPC */
export interface AdminQualityAlert {
  question_id: string;
  question_number: number | null;
  question_text: string;
  topic_title: string;
  alert_type: 'no_choices' | 'high_error_rate';
  error_rate: number | null;
  attempt_count: number;
}

/** Global stats returned by get_admin_global_stats RPC */
export interface AdminGlobalStats {
  registered_users: number;
  active_today: number;
  active_this_week: number;
  active_this_month: number;
  avg_session_duration_seconds: number;
  total_sessions: number;
  avg_score: number;
}

/** Daily session data for charts */
export interface AdminDailySession {
  day: string;
  session_count: number;
  avg_score: number;
}

/** Chapter score data for charts */
export interface AdminChapterScore {
  topic_id: string;
  topic_title: string;
  avg_score: number;
  session_count: number;
}
