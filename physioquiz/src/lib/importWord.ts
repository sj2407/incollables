/**
 * Client-side Word document parser for question import.
 * Replicates the logic from scripts/import_to_db.py using mammoth.js.
 *
 * Flow:
 *   1. mammoth converts .docx → raw HTML
 *   2. We parse the HTML to extract questions, propositions, answers, explanations
 *   3. We extract topic hierarchy from heading structure
 *   4. We extract embedded images as base64
 *   5. Returns structured JSON ready for the import Edge Function
 */

import mammoth from 'mammoth';

// ---------------------------------------------------------------------------
// Types
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
  };
  errors: string[];
}

// ---------------------------------------------------------------------------
// Regex helpers (mirroring Python script)
// ---------------------------------------------------------------------------

function isQuestionHeading(text: string): { is: boolean; num: number | null } {
  const m = text.trim().match(/^Question\s+(\d+)\s*$/);
  if (m) return { is: true, num: parseInt(m[1], 10) };
  return { is: false, num: null };
}

function isAnswerLine(text: string): boolean {
  return /^R[ée]ponses?\s*:/i.test(text.trim());
}

function isExplanationMarker(text: string): boolean {
  return /^Explication\s*:\s*$/i.test(text.trim());
}

function isSeparator(text: string): boolean {
  return text.trim() === '---';
}

function isValidChapterTitle(text: string): boolean {
  const t = text.trim();
  if (t.length > 70 || t.length < 3) return false;
  if (/^R[ée]ponses?\s*:/i.test(t)) return false;
  if (/^[A-Z]\.\s/.test(t)) return false;
  if (t[0] === t[0].toLowerCase() && t[0] !== t[0].toUpperCase()) return false;
  const lower = t.toLowerCase();
  if (['est fausse', 'est vraie', 'est juste'].some(p => lower.includes(p))) return false;
  const sentenceStarts = [/^Chez\s/i, /^S.accompagne/i, /^Peut\s/i, /^Est\s/i, /^Ne\s/i, /^Se\s/i, /^On\s/i, /^Il\s/i, /^Elle\s/i];
  if (sentenceStarts.some(r => r.test(t))) return false;
  if (t.endsWith(':') && t.length > 40) return false;
  if (["d'où", 'entraine', 'entraîne'].some(w => lower.includes(w))) return false;
  return true;
}

function cleanChapterTitle(text: string): string {
  let t = text.trim();
  t = t.replace(/\s*\(\d+\)\s*$/, '');
  t = t.replace(/\s+\d+\s*$/, '');
  t = t.replace(/^[IVXLC]+\s+/, '');
  t = t.replace(/[\s:]+$/, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function parseAnswerLetters(text: string): { letters: string[]; missing: boolean } {
  const t = text.trim().replace(/^R[ée]ponses?\s*:\s*/i, '').trim();
  if (t.includes('[MANQUANTE]')) return { letters: [], missing: true };
  const letters = t.split(/[,\s]+/).filter(p => /^[A-Z]$/.test(p.trim())).map(p => p.trim());
  return { letters, missing: false };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a .docx file (as ArrayBuffer) and return structured import data.
 * Uses mammoth.js for HTML conversion + custom parsing for question structure.
 */
export async function parseWordFile(fileBuffer: ArrayBuffer): Promise<ImportParseResult> {
  const errors: string[] = [];

  // Step 1: Convert entire doc to HTML with mammoth (for explanations + images)
  const mammothResult = await mammoth.convertToHtml(
    { arrayBuffer: fileBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageBuffer = await image.read();
        const base64 = arrayBufferToBase64(imageBuffer);
        const contentType = image.contentType || 'image/png';
        return { src: `data:${contentType};base64,${base64}` };
      }),
    }
  );

  // Step 2: Parse the HTML to extract question structure
  // We need a two-pass approach like the Python script

  // Pass 1: identify question boundaries and chapter headings from the HTML
  const htmlDoc = new DOMParser().parseFromString(mammothResult.value, 'text/html');
  const elements = Array.from(htmlDoc.body.children);

  // Build a flat list of content blocks with their types
  interface ContentBlock {
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'other';
    headingLevel?: number;
    text: string;
    html: string;
    element: Element;
  }

  const blocks: ContentBlock[] = elements.map(el => {
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim() ?? '';
    const html = el.outerHTML;

    if (/^h[1-6]$/.test(tag)) {
      return { type: 'heading' as const, headingLevel: parseInt(tag[1]), text, html, element: el };
    }
    if (tag === 'p') return { type: 'paragraph' as const, text, html, element: el };
    if (tag === 'ul' || tag === 'ol') return { type: 'list' as const, text, html, element: el };
    if (tag === 'table') return { type: 'table' as const, text, html, element: el };
    return { type: 'other' as const, text, html, element: el };
  });

  // Pass 1: Find question starts and separators
  const questionStarts: { index: number; num: number }[] = [];
  const separatorIndices = new Set<number>();

  for (let i = 0; i < blocks.length; i++) {
    const { is, num } = isQuestionHeading(blocks[i].text);
    if (is && num !== null) questionStarts.push({ index: i, num });
    if (isSeparator(blocks[i].text)) separatorIndices.add(i);
  }

  // Determine inside-question ranges
  const insideQuestion = new Set<number>();
  for (let qi = 0; qi < questionStarts.length; qi++) {
    const startI = questionStarts[qi].index;
    const nextQ = qi + 1 < questionStarts.length ? questionStarts[qi + 1].index : blocks.length;
    let endI = nextQ;
    for (let si = startI + 1; si < nextQ; si++) {
      if (separatorIndices.has(si)) { endI = si + 1; break; }
    }
    for (let j = startI; j < endI; j++) insideQuestion.add(j);
  }

  // Collect real chapter headings (outside question blocks)
  const realHeadings = new Map<number, { level: number; title: string }>();
  for (let i = 0; i < blocks.length; i++) {
    if (insideQuestion.has(i)) continue;
    const b = blocks[i];
    if (b.type === 'heading' && b.headingLevel && b.headingLevel <= 3) {
      const { is: isQ } = isQuestionHeading(b.text);
      if (!isQ && isValidChapterTitle(b.text)) {
        const clean = cleanChapterTitle(b.text);
        if (clean) realHeadings.set(i, { level: b.headingLevel, title: clean });
      }
    }
  }

  // Pass 2: Parse questions with chapter context
  const questions: ParsedQuestion[] = [];
  let currentChapterPath: string[] = [];

  let i = 0;
  while (i < blocks.length) {
    // Update chapter context
    if (realHeadings.has(i)) {
      const { level, title } = realHeadings.get(i)!;
      if (level === 1) currentChapterPath = [title];
      else if (level === 2) currentChapterPath = currentChapterPath.slice(0, 1).concat(title);
      else if (level === 3) currentChapterPath = currentChapterPath.slice(0, 2).concat(title);
      i++;
      continue;
    }

    // Check for question heading
    const { is: isQ, num: qNum } = isQuestionHeading(blocks[i].text);
    if (isQ && qNum !== null) {
      const question: ParsedQuestion = {
        sequentialNumber: qNum,
        stemText: '',
        propositions: [],
        answerLetters: [],
        answerMissing: false,
        explanationHtml: '',
        chapterPath: [...currentChapterPath],
        stemImages: [],
      };

      i++; // skip "Question N" heading
      let state: 'stem' | 'propositions' | 'explanation' | 'post_answer' = 'stem';
      const explanationParts: string[] = [];
      const stemParts: string[] = [];

      while (i < blocks.length) {
        const b = blocks[i];

        if (isSeparator(b.text)) { i++; break; }
        const { is: nextIsQ } = isQuestionHeading(b.text);
        if (nextIsQ) break;
        if (b.text.startsWith('[WARNING]') || b.text.startsWith('Answer mismatch:')) { i++; continue; }

        if (isExplanationMarker(b.text)) { state = 'explanation'; i++; continue; }

        if (isAnswerLine(b.text)) {
          const { letters, missing } = parseAnswerLetters(b.text);
          question.answerLetters = letters;
          question.answerMissing = missing;
          state = 'post_answer';
          i++;
          continue;
        }

        // Proposition: "A. text"
        const propMatch = b.text.match(/^([A-Z])\.\s*(.*)/);
        if (propMatch && (state === 'stem' || state === 'propositions')) {
          state = 'propositions';
          question.propositions.push({ letter: propMatch[1], text: propMatch[2].trim() });
          i++;
          continue;
        }

        if (state === 'stem') {
          if (b.text) stemParts.push(b.text);
          // Extract images from stem
          const imgs = b.element.querySelectorAll('img');
          imgs.forEach((img, idx) => {
            const src = img.getAttribute('src');
            if (src?.startsWith('data:')) {
              const [meta, base64] = src.split(',');
              const contentType = meta.match(/data:(.*?);/)?.[1] ?? 'image/png';
              question.stemImages.push({ base64, contentType, sortOrder: idx });
            }
          });
        } else if (state === 'explanation' || state === 'post_answer') {
          explanationParts.push(b.html);
        }

        i++;
      }

      question.stemText = stemParts.join(' ');
      question.explanationHtml = explanationParts.join('\n');
      questions.push(question);
      continue;
    }

    i++;
  }

  // Build topic tree
  const topics = buildTopicTree(questions);

  // Compute stats
  const activeCount = questions.filter(q => !q.answerMissing && q.propositions.length >= 3 && q.answerLetters.length > 0).length;
  const stats = {
    totalQuestions: questions.length,
    activeQuestions: activeCount,
    inactiveQuestions: questions.length - activeCount,
    withExplanation: questions.filter(q => q.explanationHtml.length > 0).length,
    totalImages: questions.reduce((sum, q) => sum + q.stemImages.length, 0),
    totalTopics: countTopics(topics),
  };

  // Validation warnings
  for (const q of questions) {
    if (q.answerMissing) errors.push(`Q${q.sequentialNumber}: réponse manquante — désactivée`);
    if (q.propositions.length === 0) errors.push(`Q${q.sequentialNumber}: aucune proposition — désactivée`);
    if (q.propositions.length > 0 && q.propositions.length < 3) errors.push(`Q${q.sequentialNumber}: seulement ${q.propositions.length} propositions — désactivée`);
    if (!q.answerMissing && q.answerLetters.length === 0 && q.propositions.length > 0) errors.push(`Q${q.sequentialNumber}: aucune réponse correcte — désactivée`);
  }

  return { questions, topics, stats, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTopicTree(questions: ParsedQuestion[]): ParsedTopic[] {
  const roots: ParsedTopic[] = [];
  const seen = new Map<string, ParsedTopic>();

  for (const q of questions) {
    if (!q.chapterPath.length) continue;
    for (let depth = 0; depth < q.chapterPath.length; depth++) {
      const pathKey = q.chapterPath.slice(0, depth + 1).join('///');
      if (seen.has(pathKey)) continue;
      const node: ParsedTopic = {
        title: q.chapterPath[depth],
        level: depth + 1,
        sortOrder: seen.size,
        children: [],
      };
      seen.set(pathKey, node);
      if (depth === 0) {
        roots.push(node);
      } else {
        const parentKey = q.chapterPath.slice(0, depth).join('///');
        const parent = seen.get(parentKey);
        if (parent) parent.children.push(node);
      }
    }
  }

  return roots;
}

function countTopics(nodes: ParsedTopic[]): number {
  let total = 0;
  for (const n of nodes) {
    total += 1 + countTopics(n.children);
  }
  return total;
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
