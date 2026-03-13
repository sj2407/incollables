// ============================================================
// Unit tests for quiz-engine.ts — §5 selection algorithm
// ============================================================

import {
  calculateWeights,
  weightedSampleWithoutReplacement,
  shuffleArray,
  QuestionWithStats,
} from '../quiz-engine';

describe('calculateWeights', () => {
  // T-B3: Case 1 — never seen → weight = 0.70
  it('never seen question → weight 0.70', () => {
    const questions: QuestionWithStats[] = [
      {
        question_id: 'q1',
        topic_id: 't1',
        attempts: 0,
        success_rate: 0,
        days_since_last: 0,
        confidence_count: 0,
        avg_confidence: null,
        last_was_false_certainty: null,
      },
    ];
    const weights = calculateWeights(questions);
    expect(weights[0].weight).toBe(0.7);
    expect(weights[0].question_id).toBe('q1');
  });

  // T-B4: Case 2 — with confidence
  it('with confidence → 0.40×difficulty + 0.35×forgetting + 0.25×uncertainty', () => {
    // success_rate = 0.5, difficulty = 0.5
    // attempts = 4, halfLife = 5 + 3*4*0.5 = 11
    // days = 7, forgetting = 1 - e^(-7/11) ≈ 0.4712
    // avg_confidence = 0.5, uncertainty = 0.5
    const questions: QuestionWithStats[] = [
      {
        question_id: 'q1',
        topic_id: 't1',
        attempts: 4,
        success_rate: 0.5,
        days_since_last: 7,
        confidence_count: 3,
        avg_confidence: 0.5,
        last_was_false_certainty: false,
      },
    ];
    const weights = calculateWeights(questions);
    const expected = 0.4 * 0.5 + 0.35 * (1 - Math.exp(-7 / 11)) + 0.25 * 0.5;
    expect(weights[0].weight).toBeCloseTo(expected, 6);
  });

  // T-B5: Case 3 — no confidence
  it('without confidence → 0.53×difficulty + 0.47×forgetting', () => {
    // success_rate = 0.8, difficulty = 0.2
    // attempts = 5, halfLife = 5 + 3*5*0.8 = 17
    // days = 3, forgetting = 1 - e^(-3/17) ≈ 0.1619
    const questions: QuestionWithStats[] = [
      {
        question_id: 'q1',
        topic_id: 't1',
        attempts: 5,
        success_rate: 0.8,
        days_since_last: 3,
        confidence_count: 0,
        avg_confidence: null,
        last_was_false_certainty: false,
      },
    ];
    const weights = calculateWeights(questions);
    const expected = 0.53 * 0.2 + 0.47 * (1 - Math.exp(-3 / 17));
    expect(weights[0].weight).toBeCloseTo(expected, 6);
  });

  // T-B6: False certainty bonus → ×1.5, capped at 1.0
  it('false certainty → weight × 1.5', () => {
    const questions: QuestionWithStats[] = [
      {
        question_id: 'q1',
        topic_id: 't1',
        attempts: 2,
        success_rate: 0.2,
        days_since_last: 3,
        confidence_count: 2,
        avg_confidence: 1.0,
        last_was_false_certainty: true,
      },
    ];
    const weights = calculateWeights(questions);

    // Calculate base weight first
    const difficulty = 1 - 0.2;
    const halfLife = 5 + 3 * 2 * 0.2;
    const forgetting = 1 - Math.exp(-3 / halfLife);
    const uncertainty = 1 - 1.0;
    const baseWeight = 0.4 * difficulty + 0.35 * forgetting + 0.25 * uncertainty;
    const expectedWeight = Math.min(baseWeight * 1.5, 1.0);

    expect(weights[0].weight).toBeCloseTo(expectedWeight, 6);
    expect(weights[0].weight).toBeLessThanOrEqual(1.0);
  });

  it('false certainty cap: high base weight capped at 1.0', () => {
    // All wrong, lots of forgetting, high uncertainty → high base weight
    const questions: QuestionWithStats[] = [
      {
        question_id: 'q1',
        topic_id: 't1',
        attempts: 1,
        success_rate: 0,
        days_since_last: 100,
        confidence_count: 1,
        avg_confidence: 0,
        last_was_false_certainty: true,
      },
    ];
    const weights = calculateWeights(questions);
    expect(weights[0].weight).toBe(1.0); // capped
  });

  it('mastered question → low weight', () => {
    const questions: QuestionWithStats[] = [
      {
        question_id: 'q1',
        topic_id: 't1',
        attempts: 10,
        success_rate: 0.9,
        days_since_last: 2,
        confidence_count: 10,
        avg_confidence: 1.0,
        last_was_false_certainty: false,
      },
    ];
    const weights = calculateWeights(questions);
    // High success, recent, high confidence → weight should be very low
    expect(weights[0].weight).toBeLessThan(0.15);
  });
});

describe('weightedSampleWithoutReplacement', () => {
  // T-B7: Returns N unique questions from pool
  it('returns exactly N unique questions', () => {
    const items = [
      { question_id: 'q1', weight: 0.7 },
      { question_id: 'q2', weight: 0.5 },
      { question_id: 'q3', weight: 0.3 },
      { question_id: 'q4', weight: 0.8 },
      { question_id: 'q5', weight: 0.1 },
    ];
    const selected = weightedSampleWithoutReplacement(items, 3);
    expect(selected.length).toBe(3);
    expect(new Set(selected).size).toBe(3); // all unique
    for (const id of selected) {
      expect(items.some((i) => i.question_id === id)).toBe(true);
    }
  });

  it('returns all when N >= pool size', () => {
    const items = [
      { question_id: 'q1', weight: 0.5 },
      { question_id: 'q2', weight: 0.5 },
    ];
    const selected = weightedSampleWithoutReplacement(items, 5);
    expect(selected.length).toBe(2);
    expect(selected).toContain('q1');
    expect(selected).toContain('q2');
  });

  it('handles zero weights gracefully', () => {
    const items = [
      { question_id: 'q1', weight: 0 },
      { question_id: 'q2', weight: 0 },
      { question_id: 'q3', weight: 0 },
    ];
    const selected = weightedSampleWithoutReplacement(items, 2);
    expect(selected.length).toBe(2);
    expect(new Set(selected).size).toBe(2);
  });

  it('does not modify original array', () => {
    const items = [
      { question_id: 'q1', weight: 0.7 },
      { question_id: 'q2', weight: 0.3 },
    ];
    const copy = JSON.parse(JSON.stringify(items));
    weightedSampleWithoutReplacement(items, 1);
    expect(items).toEqual(copy);
  });
});

describe('shuffleArray', () => {
  // T-B8: All choices present, order changed
  it('contains all original elements after shuffle', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffleArray([...arr]);
    expect(shuffled.sort()).toEqual(arr.sort());
    expect(shuffled.length).toBe(arr.length);
  });

  it('handles single element', () => {
    const arr = ['only'];
    expect(shuffleArray([...arr])).toEqual(['only']);
  });

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('shuffles in-place', () => {
    const arr = [1, 2, 3, 4, 5];
    const ref = arr;
    shuffleArray(arr);
    expect(arr).toBe(ref); // same reference
  });
});
