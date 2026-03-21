/**
 * Client-side duplicate question detector.
 * Groups questions by normalized (énoncé + propositions) fingerprint.
 * Order-independent, case-insensitive, accent-insensitive.
 */

import type { AdminQuestionRow } from '@/types/admin';

/** Normalize text for fuzzy comparison: strip accents, lowercase, collapse whitespace. */
function normalize(text: string): string {
  // Decode HTML entities (e.g. &amp; → &) using a throwaway element
  if (typeof document !== 'undefined' && text.includes('&')) {
    const el = document.createElement('span');
    el.innerHTML = text;
    text = el.textContent ?? text;
  }
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a fingerprint: normalized énoncé + sorted normalized propositions. */
function fingerprint(q: AdminQuestionRow): string {
  const stem = normalize(q.question_text);
  const choices = q.all_choices
    .map((c) => normalize(c.choice_text))
    .sort()
    .join('|');
  return `${stem}||${choices}`;
}

export interface DuplicateResult {
  /** Map from group number (1-based) to array of question_ids in that group. */
  groups: Map<number, string[]>;
  /** Flat set of all duplicate question_ids (for quick lookup). */
  duplicateIds: Set<string>;
  /** Number of duplicate groups found. */
  groupCount: number;
}

/**
 * Find duplicate questions in the given array.
 * Two questions are duplicates if they have the same normalized énoncé
 * AND the same set of normalized propositions (order-independent).
 */
export function findDuplicates(questions: AdminQuestionRow[]): DuplicateResult {
  // Group by fingerprint
  const fpMap = new Map<string, string[]>();
  for (const q of questions) {
    const fp = fingerprint(q);
    const group = fpMap.get(fp);
    if (group) {
      group.push(q.question_id);
    } else {
      fpMap.set(fp, [q.question_id]);
    }
  }

  // Keep only groups with 2+ members
  const groups = new Map<number, string[]>();
  const duplicateIds = new Set<string>();
  let groupNum = 0;

  for (const ids of Array.from(fpMap.values())) {
    if (ids.length >= 2) {
      groupNum++;
      groups.set(groupNum, ids);
      for (const id of ids) duplicateIds.add(id);
    }
  }

  return { groups, duplicateIds, groupCount: groupNum };
}

/**
 * Build a lookup from question_id → group number.
 * Used by QuestionGrid for visual grouping (row tints).
 */
export function buildGroupLookup(groups: Map<number, string[]>): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const [groupNum, ids] of Array.from(groups)) {
    for (const id of ids) lookup.set(id, groupNum);
  }
  return lookup;
}
