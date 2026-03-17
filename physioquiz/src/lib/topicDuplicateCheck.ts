/**
 * Find topics with similar titles to detect typos.
 * Uses normalized Levenshtein distance comparison.
 */

interface TopicLike {
  id: string;
  title: string;
}

/** Remove accents, lowercase, trim */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity score (0-1, where 1 = identical) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Find topics with titles similar to `title` (>= 80% similarity).
 * Excludes the topic with `excludeId` from results.
 */
export function findSimilarTopics(
  title: string,
  allTopics: TopicLike[],
  excludeId?: string,
  threshold = 0.8,
): TopicLike[] {
  const normalizedTitle = normalize(title);
  if (!normalizedTitle) return [];

  return allTopics
    .filter((t) => t.id !== excludeId)
    .filter((t) => {
      const norm = normalize(t.title);
      // Exact match after normalization — definitely a duplicate
      if (norm === normalizedTitle) return true;
      // Skip very different length strings (but allow prefix matches)
      if (Math.abs(norm.length - normalizedTitle.length) > 10) return false;
      // Check if one is a prefix of the other (e.g., "Systeme nerveux" vs "Systeme nerveux autonome")
      if (norm.startsWith(normalizedTitle) || normalizedTitle.startsWith(norm)) return true;
      return similarity(normalizedTitle, norm) >= threshold;
    });
}
