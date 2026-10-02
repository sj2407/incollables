// ============================================================
// PhysioQuiz — Client question assembly
// published_questions rows (+ nested images) + safe_choices → ordered client questions
// ============================================================

import type { SafeChoice } from '@/types';

export interface PublishedQuestionImageRow {
  id: string;
  storage_path: string;
  original_name: string | null;
  sort_order: number;
}

/** Row shape returned by `published_questions` selected with `PUBLISHED_QUESTION_SELECT`. */
export interface PublishedQuestionRow {
  id: string;
  question_number: number | null;
  question_text: string;
  topic_id: string;
  published_question_images: PublishedQuestionImageRow[] | null;
}

export interface AssembledQuestion {
  id: string;
  question_number: number | null;
  question_text: string;
  topic_id: string;
  question_images: PublishedQuestionImageRow[];
  choices: SafeChoice[];
}

export const PUBLISHED_QUESTION_SELECT =
  'id, question_number, question_text, topic_id, published_question_images (id, storage_path, original_name, sort_order)';

export function getQuestionImagesBaseUrl(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/question-images/`;
}

export function groupChoicesByQuestion(choices: SafeChoice[]): Record<string, SafeChoice[]> {
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
  return choicesByQuestion;
}

/**
 * Build the question list in `questionIds` order, with images sorted and their
 * storage paths resolved against `storageBaseUrl` (absolute URLs are kept as-is).
 * Ids without a matching row are skipped.
 */
export function buildQuestionsWithImages(
  questionIds: string[],
  rows: PublishedQuestionRow[],
  choices: SafeChoice[],
  storageBaseUrl: string,
): AssembledQuestion[] {
  const choicesByQuestion = groupChoicesByQuestion(choices);
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const questions: AssembledQuestion[] = [];

  for (const qId of questionIds) {
    const row = rowsById.get(qId);
    if (!row) continue;
    const { published_question_images, ...fields } = row;
    const images = [...(published_question_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        ...img,
        storage_path: img.storage_path.startsWith('http')
          ? img.storage_path
          : storageBaseUrl + img.storage_path,
      }));
    questions.push({
      ...fields,
      question_images: images,
      choices: choicesByQuestion[qId] ?? [],
    });
  }

  return questions;
}
