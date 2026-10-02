// ============================================================
// Unit tests for question-assembly.ts
// ============================================================

import { buildQuestionsWithImages, groupChoicesByQuestion } from '../question-assembly';
import type { PublishedQuestionRow } from '../question-assembly';
import type { SafeChoice } from '@/types';

const BASE = 'https://example.supabase.co/storage/v1/object/public/question-images/';

const choice = (id: string, question_id: string, sort_order: number): SafeChoice => ({
  id,
  question_id,
  label: id.toUpperCase(),
  choice_text: `text ${id}`,
  sort_order,
});

const row = (
  id: string,
  images: PublishedQuestionRow['published_question_images'] = [],
): PublishedQuestionRow => ({
  id,
  question_number: 1,
  question_text: `question ${id}`,
  topic_id: 't1',
  published_question_images: images,
});

describe('groupChoicesByQuestion', () => {
  it('groups by question_id and sorts by sort_order', () => {
    const grouped = groupChoicesByQuestion([
      choice('b', 'q1', 2),
      choice('x', 'q2', 1),
      choice('a', 'q1', 1),
    ]);
    expect(grouped.q1.map((c) => c.id)).toEqual(['a', 'b']);
    expect(grouped.q2.map((c) => c.id)).toEqual(['x']);
  });
});

describe('buildQuestionsWithImages', () => {
  it('orders questions by questionIds and skips missing rows', () => {
    const result = buildQuestionsWithImages(
      ['q2', 'missing', 'q1'],
      [row('q1'), row('q2')],
      [],
      BASE,
    );
    expect(result.map((q) => q.id)).toEqual(['q2', 'q1']);
  });

  it('attaches sorted choices and defaults to an empty list', () => {
    const result = buildQuestionsWithImages(
      ['q1', 'q2'],
      [row('q1'), row('q2')],
      [choice('b', 'q1', 2), choice('a', 'q1', 1)],
      BASE,
    );
    expect(result[0].choices.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result[1].choices).toEqual([]);
  });

  it('sorts images and prefixes relative storage paths only', () => {
    const [q] = buildQuestionsWithImages(
      ['q1'],
      [
        row('q1', [
          {
            id: 'i2',
            storage_path: 'https://cdn.example/abs.png',
            original_name: null,
            sort_order: 2,
          },
          { id: 'i1', storage_path: 'rel/one.png', original_name: 'one.png', sort_order: 1 },
        ]),
      ],
      [],
      BASE,
    );
    expect(q.question_images).toEqual([
      { id: 'i1', storage_path: `${BASE}rel/one.png`, original_name: 'one.png', sort_order: 1 },
      { id: 'i2', storage_path: 'https://cdn.example/abs.png', original_name: null, sort_order: 2 },
    ]);
  });

  it('maps the published_question_images relation to question_images', () => {
    const [q] = buildQuestionsWithImages(['q1'], [row('q1', null)], [], BASE);
    expect(q).toEqual({
      id: 'q1',
      question_number: 1,
      question_text: 'question q1',
      topic_id: 't1',
      question_images: [],
      choices: [],
    });
    expect(q).not.toHaveProperty('published_question_images');
  });
});
