// Mastery color scale from BRAND.md (7 levels)
// Maps mastery percentage to heatmap colors

interface MasteryLevel {
  label: string;
  color: string;
  min: number;
  max: number;
}

const MASTERY_LEVELS: MasteryLevel[] = [
  { label: 'Non tenté', color: '#BDC3C7', min: -1, max: -1 },
  { label: 'Lacune grave', color: '#B91C1C', min: 0, max: 20 },
  { label: 'En difficulté', color: '#DC2626', min: 20, max: 40 },
  { label: 'En progression', color: '#B45309', min: 40, max: 60 },
  { label: 'Correct', color: '#D97706', min: 60, max: 75 },
  { label: 'Bon', color: '#0ea5e9', min: 75, max: 90 },
  { label: 'Maîtrisé', color: '#10B981', min: 90, max: 101 },
];

/**
 * Returns the heatmap color for a given mastery percentage.
 * Pass -1 or null for "not attempted".
 */
export function getMasteryColor(mastery: number | null): string {
  if (mastery === null || mastery < 0) return MASTERY_LEVELS[0].color;
  for (let i = MASTERY_LEVELS.length - 1; i >= 1; i--) {
    if (mastery >= MASTERY_LEVELS[i].min) return MASTERY_LEVELS[i].color;
  }
  return MASTERY_LEVELS[1].color;
}

/**
 * Returns the French label for a given mastery percentage.
 * Pass -1 or null for "not attempted".
 */
export function getMasteryLabel(mastery: number | null): string {
  if (mastery === null || mastery < 0) return MASTERY_LEVELS[0].label;
  for (let i = MASTERY_LEVELS.length - 1; i >= 1; i--) {
    if (mastery >= MASTERY_LEVELS[i].min) return MASTERY_LEVELS[i].label;
  }
  return MASTERY_LEVELS[1].label;
}

/** All mastery levels for rendering legends */
export const MASTERY_SCALE = MASTERY_LEVELS;
