// ============================================================
// Unit tests for scoring.ts — §5bis scoring rules
// ============================================================

import { scoreAnswer } from '../scoring';

// Test fixture: question with correct answers A, C, E (3 correct out of 5)
const choices = [
  { id: 'a', is_correct: true },
  { id: 'b', is_correct: false },
  { id: 'c', is_correct: true },
  { id: 'd', is_correct: false },
  { id: 'e', is_correct: true },
];

describe('scoreAnswer', () => {
  // §5bis.3 — 7 examples from the architecture doc

  it('partial: selects A only → 33.3%', () => {
    const result = scoreAnswer(['a'], choices);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(true);
    expect(result.score_percent).toBeCloseTo(33.3, 1);
  });

  it('partial: selects A, C → 66.7%', () => {
    const result = scoreAnswer(['a', 'c'], choices);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(true);
    expect(result.score_percent).toBeCloseTo(66.7, 1);
  });

  it('all correct: selects A, C, E → 100%', () => {
    const result = scoreAnswer(['a', 'c', 'e'], choices);
    expect(result.is_correct).toBe(true);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(100);
  });

  it('1 wrong cancels: selects A, B → 0%', () => {
    const result = scoreAnswer(['a', 'b'], choices);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(0);
  });

  it('1 wrong cancels: selects A, C, B → 0%', () => {
    const result = scoreAnswer(['a', 'c', 'b'], choices);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(0);
  });

  it('all wrong: selects B, D → 0%', () => {
    const result = scoreAnswer(['b', 'd'], choices);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(0);
  });

  it('nothing selected → 0%', () => {
    const result = scoreAnswer([], choices);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(0);
  });

  // T-B2: edge case — single correct answer
  it('single correct answer: selects it → 100%', () => {
    const singleCorrect = [
      { id: 'a', is_correct: true },
      { id: 'b', is_correct: false },
      { id: 'c', is_correct: false },
    ];
    const result = scoreAnswer(['a'], singleCorrect);
    expect(result.is_correct).toBe(true);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(100);
  });

  it('single correct answer: selects wrong → 0%', () => {
    const singleCorrect = [
      { id: 'a', is_correct: true },
      { id: 'b', is_correct: false },
    ];
    const result = scoreAnswer(['b'], singleCorrect);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(0);
  });

  it('single correct answer: nothing selected → 0%', () => {
    const singleCorrect = [{ id: 'a', is_correct: true }];
    const result = scoreAnswer([], singleCorrect);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(false);
    expect(result.score_percent).toBe(0);
  });

  // Edge: all choices are correct
  it('all choices correct: select all → 100%', () => {
    const allCorrect = [
      { id: 'a', is_correct: true },
      { id: 'b', is_correct: true },
    ];
    const result = scoreAnswer(['a', 'b'], allCorrect);
    expect(result.is_correct).toBe(true);
    expect(result.score_percent).toBe(100);
  });

  it('all choices correct: select one → partial 50%', () => {
    const allCorrect = [
      { id: 'a', is_correct: true },
      { id: 'b', is_correct: true },
    ];
    const result = scoreAnswer(['a'], allCorrect);
    expect(result.is_correct).toBe(false);
    expect(result.is_partially_correct).toBe(true);
    expect(result.score_percent).toBe(50);
  });
});
