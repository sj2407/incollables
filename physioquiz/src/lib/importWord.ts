/**
 * Client-side wrapper for the server-side Word parser.
 * Sends the .docx file to /api/parse-word and returns structured import data.
 *
 * The actual parsing logic (mammoth + HTML parsing) runs server-side in
 * src/app/api/parse-word/route.ts to reduce client bundle size.
 */

// ---------------------------------------------------------------------------
// Types (unchanged — used by import/page.tsx and the API route)
// ---------------------------------------------------------------------------

export interface ParsedProposition {
  letter: string;
  text: string;
}

export interface ParsedQuestion {
  sequentialNumber: number;
  stemText: string;
  propositions: ParsedProposition[];
  answerLetters: string[];
  answerMissing: boolean;
  explanationHtml: string;
  chapterPath: string[];
  /** base64-encoded images from the question stem */
  stemImages: { base64: string; contentType: string; sortOrder: number }[];
}

export interface ParsedTopic {
  title: string;
  level: number;
  sortOrder: number;
  children: ParsedTopic[];
}

export interface ImportParseResult {
  questions: ParsedQuestion[];
  topics: ParsedTopic[];
  stats: {
    totalQuestions: number;
    activeQuestions: number;
    inactiveQuestions: number;
    withExplanation: number;
    totalImages: number;
    totalTopics: number;
    totalChapters: number;
    totalSubchapters: number;
  };
  errors: string[];
}

// ---------------------------------------------------------------------------
// Client entry point
// ---------------------------------------------------------------------------

/** Parse a .docx file via the server-side API route. */
export async function parseWordFile(
  fileBuffer: ArrayBuffer,
): Promise<ImportParseResult> {
  const response = await fetch('/api/parse-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fileBuffer,
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(err.error || `Erreur ${response.status}`);
  }

  return response.json();
}
