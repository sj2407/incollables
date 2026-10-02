// ============================================================
// PhysioQuiz — Scoring logic (§5bis)
// Partial scoring: 1 wrong checked = 0%, partial = correct/total
// ============================================================

export interface ScoringResult {
  is_correct: boolean;
  is_partially_correct: boolean;
  score_percent: number;
}

/**
 * Score a student's answer using partial scoring rules.
 *
 * Rules (§5bis.2):
 * - If any incorrect choice is selected → score = 0%
 * - If all correct choices selected and none incorrect → score = 100%
 * - If only some correct choices selected (no incorrect) → score = correctSelected/totalCorrect × 100
 * - If nothing selected → score = 0%
 */
export function scoreAnswer(
  selectedChoiceIds: string[],
  allChoices: { id: string; is_correct: boolean }[],
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
