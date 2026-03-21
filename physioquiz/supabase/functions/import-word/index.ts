// ============================================================
// Edge Function: import-word
// Receives parsed question data from client-side mammoth.js
// and inserts topics, questions, choices, images into Supabase.
//
// All imported questions get is_active = false (admin must review
// and activate manually from the Base de données tab).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Types ---

interface ImportProposition {
  letter: string;
  text: string;
}

interface ImportQuestion {
  sequentialNumber: number;
  stemText: string;
  propositions: ImportProposition[];
  answerLetters: string[];
  answerMissing: boolean;
  explanationHtml: string;
  chapterPath: string[];
  stemImages: { base64: string; contentType: string; sortOrder: number }[];
}

interface ImportTopic {
  title: string;
  level: number;
  sortOrder: number;
  children: ImportTopic[];
}

interface ImportPayload {
  questions: ImportQuestion[];
  topics: ImportTopic[];
}

// --- Helpers ---

function generateUUID(): string {
  return crypto.randomUUID();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Strip HTML tags and decode common entities → clean plain text. */
function stripHtmlToPlainText(html: string): string {
  // Remove all HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Find all <img src="data:...;base64,..."> in HTML, upload each to
 * Supabase Storage, and replace the data URI with the public URL.
 */
// deno-lint-ignore no-explicit-any
async function replaceBase64ImagesWithStorageUrls(
  html: string,
  pathPrefix: string,
  adminClient: any,
): Promise<string> {
  if (!html) return html;

  const regex = /<img\s+[^>]*src="data:([^;]+);base64,([^"]+)"[^>]*\/?>/gi;
  let result = html;
  const matches: Array<{ fullMatch: string; contentType: string; base64: string }> = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    // Size guard: skip images with > 5 MB of base64 data (~3.75 MB decoded)
    if (match[2].length > 5 * 1024 * 1024) continue;
    matches.push({ fullMatch: match[0], contentType: match[1], base64: match[2] });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    try {
      const bytes = base64ToUint8Array(m.base64);
      const ext = (m.contentType.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
      const filename = `${pathPrefix}_${i}.${ext}`;

      await adminClient.storage.from('question-images').upload(filename, bytes, {
        contentType: m.contentType,
        upsert: true,
      });

      const { data } = adminClient.storage.from('question-images').getPublicUrl(filename);
      if (data?.publicUrl) {
        result = result.replace(m.fullMatch, `<img src="${data.publicUrl}" />`);
      }
    } catch (err) {
      console.error(`Failed to upload explanation image ${i}:`, err);
      // Leave base64 as-is on failure (graceful fallback)
    }
  }

  return result;
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth: require admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-scoped client (for role check)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse body
    const payload: ImportPayload = await req.json();

    if (!payload.questions || !Array.isArray(payload.questions)) {
      return new Response(JSON.stringify({ error: 'Invalid payload: questions array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Step 1: Insert topics ---
    const topicMapping = new Map<string, string>(); // pathKey → uuid

    async function insertTopics(nodes: ImportTopic[], parentId: string | null, pathPrefix: string[]) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const pathKey = [...pathPrefix, node.title].join('///');

        // Check if topic already exists with this title + parent
        const { data: existing } = await adminClient
          .from('topics')
          .select('id')
          .eq('title', node.title)
          .is('parent_id', parentId ? undefined : null)
          .maybeSingle();

        let topicId: string;

        // If parent_id is not null, use a different query
        if (parentId && !existing) {
          const { data: existingWithParent } = await adminClient
            .from('topics')
            .select('id')
            .eq('title', node.title)
            .eq('parent_id', parentId)
            .maybeSingle();

          if (existingWithParent) {
            topicId = existingWithParent.id;
          } else {
            topicId = generateUUID();
            await adminClient.from('topics').insert({
              id: topicId,
              parent_id: parentId,
              title: node.title,
              level: node.level,
              sort_order: node.sortOrder,
              is_active: true,
            }).throwOnError();
          }
        } else if (existing) {
          topicId = existing.id;
        } else {
          topicId = generateUUID();
          await adminClient.from('topics').insert({
            id: topicId,
            parent_id: parentId,
            title: node.title,
            level: node.level,
            sort_order: node.sortOrder,
            is_active: true,
          }).throwOnError();
        }

        topicMapping.set(pathKey, topicId);

        if (node.children.length > 0) {
          await insertTopics(node.children, topicId, [...pathPrefix, node.title]);
        }
      }
    }

    await insertTopics(payload.topics, null, []);

    // --- Step 2: Create default topic for uncategorized questions ---
    let defaultTopicId: string | null = null;

    // --- Step 3: Process questions ---
    const stats = {
      inserted: 0,
      active: 0,
      inactive: 0,
      imagesUploaded: 0,
      withExplanation: 0,
      errors: [] as string[],
    };

    for (const q of payload.questions) {
      try {
        // Find topic ID
        let topicId: string | null = null;
        if (q.chapterPath.length > 0) {
          for (let depth = q.chapterPath.length; depth > 0; depth--) {
            const pathKey = q.chapterPath.slice(0, depth).join('///');
            if (topicMapping.has(pathKey)) {
              topicId = topicMapping.get(pathKey)!;
              break;
            }
          }
        }

        if (!topicId) {
          if (!defaultTopicId) {
            defaultTopicId = generateUUID();
            await adminClient.from('topics').insert({
              id: defaultTopicId,
              parent_id: null,
              title: 'Non classé',
              level: 1,
              sort_order: 999,
              is_active: true,
            }).throwOnError();
          }
          topicId = defaultTopicId;
        }

        // Determine active status
        const isActive = false; // All imports start inactive — admin reviews
        const hasIssues = q.answerMissing || q.propositions.length < 3 ||
          (!q.answerMissing && q.answerLetters.length === 0 && q.propositions.length > 0);

        // Upload stem images
        const imageRecords: { storagePath: string; originalName: string; sortOrder: number }[] = [];
        for (const img of q.stemImages) {
          try {
            const bytes = base64ToUint8Array(img.base64);
            const ext = img.contentType.split('/')[1] || 'png';
            const filename = `q${q.sequentialNumber}/img_${img.sortOrder}.${ext}`;

            await adminClient.storage.from('question-images').upload(filename, bytes, {
              contentType: img.contentType,
              upsert: true,
            });

            imageRecords.push({
              storagePath: filename,
              originalName: `img_${img.sortOrder}.${ext}`,
              sortOrder: img.sortOrder,
            });
            stats.imagesUploaded++;
          } catch (imgErr) {
            stats.errors.push(`Q${q.sequentialNumber}: image upload failed — ${imgErr}`);
          }
        }

        // Clean question text: strip HTML tags → plain text
        const cleanQuestionText = stripHtmlToPlainText(q.stemText);

        // Clean explanation: replace base64 images with Supabase Storage URLs
        const cleanExplanationHtml = q.explanationHtml
          ? await replaceBase64ImagesWithStorageUrls(
              q.explanationHtml,
              `q${q.sequentialNumber}/expl`,
              adminClient,
            )
          : null;

        // Insert question
        const questionId = generateUUID();
        await adminClient.from('questions').insert({
          id: questionId,
          topic_id: topicId,
          question_number: q.sequentialNumber,
          question_text: cleanQuestionText,
          explanation_html: cleanExplanationHtml,
          difficulty: 'medium',
          is_active: isActive,
          needs_review: true,
        }).throwOnError();

        // Insert choices
        if (q.propositions.length > 0) {
          const answerSet = new Set(q.answerLetters);
          const choiceRows = q.propositions.map((prop, idx) => ({
            id: generateUUID(),
            question_id: questionId,
            label: prop.letter,
            choice_text: prop.text,
            is_correct: answerSet.has(prop.letter),
            sort_order: idx,
          }));
          await adminClient.from('choices').insert(choiceRows).throwOnError();
        }

        // Insert question images
        if (imageRecords.length > 0) {
          const imageRows = imageRecords.map(rec => ({
            id: generateUUID(),
            question_id: questionId,
            storage_path: rec.storagePath,
            original_name: rec.originalName,
            sort_order: rec.sortOrder,
          }));
          await adminClient.from('question_images').insert(imageRows).throwOnError();
        }

        stats.inserted++;
        if (hasIssues) {
          stats.inactive++;
        } else {
          stats.active++;
        }
        if (q.explanationHtml) stats.withExplanation++;

      } catch (qErr) {
        stats.errors.push(`Q${q.sequentialNumber}: ${qErr}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      stats: {
        inserted: stats.inserted,
        active: stats.active,
        inactive: stats.inactive,
        imagesUploaded: stats.imagesUploaded,
        withExplanation: stats.withExplanation,
        topicsCreated: topicMapping.size,
      },
      errors: stats.errors,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Import failed: ${err}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
