// ============================================================
// PhysioQuiz — Quiz selection engine (§5)
// Weighted selection algorithm + Fisher-Yates shuffle
// ============================================================

// Matches the question_user_stats view columns in the database
export interface QuestionWithStats {
  question_id: string;
  topic_id: string;
  attempts: number;
  success_rate: number; // 0.0-1.0, already computed in the view
  days_since_last: number;
  confidence_count: number;
  avg_confidence: number | null; // null if no confidence ever recorded
  last_was_false_certainty: boolean | null;
}

export interface QuestionWeight {
  question_id: string;
  weight: number;
}

/**
 * Calculate the weight (priority) for each question based on student performance.
 *
 * Three cases (§5.2):
 * - Case 1: Never attempted → weight = 0.70
 * - Case 2: Attempted, confidence recorded → 0.40×difficulty + 0.35×forgetting + 0.25×uncertainty
 * - Case 3: Attempted, no confidence → 0.53×difficulty + 0.47×forgetting
 *
 * Bonus: false certainty (last answer wrong + confidence "sûr") → weight × 1.5, capped at 1.0
 */
export function calculateWeights(
  questions: QuestionWithStats[],
): QuestionWeight[] {
  return questions.map((q) => {
    // Case 1: never attempted
    if (!q.attempts || q.attempts === 0) {
      return { question_id: q.question_id, weight: 0.7 };
    }

    const difficulty = 1 - (q.success_rate ?? 0);

    // Forgetting component: 1 - e^(-days / halfLife)
    // halfLife = 5 + 3 × attempts × successRate
    const successRate = q.success_rate ?? 0;
    const halfLife = 5 + 3 * q.attempts * successRate;
    const daysSince = q.days_since_last ?? 0;
    const forgetting = 1 - Math.exp(-daysSince / halfLife);

    let weight: number;

    if (q.confidence_count && q.confidence_count > 0) {
      // Case 2: confidence recorded at least once
      const uncertainty = 1 - (q.avg_confidence ?? 0);
      weight = 0.4 * difficulty + 0.35 * forgetting + 0.25 * uncertainty;
    } else {
      // Case 3: confidence never recorded
      weight = 0.53 * difficulty + 0.47 * forgetting;
    }

    // False certainty bonus (§5.2)
    if (q.last_was_false_certainty) {
      weight = Math.min(weight * 1.5, 1.0);
    }

    return { question_id: q.question_id, weight };
  });
}

/**
 * Weighted random sampling without replacement (§5.3).
 *
 * Draws n items from the pool, where each item's probability of being
 * selected is proportional to its weight. After each draw, the selected
 * item is removed and probabilities are renormalized.
 *
 * Returns an array of question_ids in shuffled order (Fisher-Yates).
 */
export function weightedSampleWithoutReplacement(
  items: QuestionWeight[],
  n: number,
): string[] {
  const selected: string[] = [];
  const remaining = items.map((item) => ({ ...item }));
  const count = Math.min(n, remaining.length);

  for (let i = 0; i < count; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);

    // Edge case: all remaining weights are 0
    if (totalWeight <= 0) {
      // Fall back to uniform random selection for remaining picks
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

  // Fisher-Yates shuffle (§5.3 step 5)
  shuffleArray(selected);

  return selected;
}

/**
 * Fisher-Yates (Knuth) shuffle — in-place.
 * Used for shuffling question order and proposition order.
 */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
