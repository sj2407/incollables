/**
 * Server-side Word document parser for question import.
 *
 * Flow:
 *   1. Auth guard (admin-only)
 *   2. Write .docx to temp file
 *   3. Call Python preprocessing script (scripts/preprocessing_json.py)
 *      — python-docx for structure (questions, propositions, answers, chapters, bold detection)
 *      — mammoth for HTML (explanation formatting, embedded images as base64)
 *   4. Returns structured JSON ready for the import Edge Function
 */

import { createClient } from '@/lib/supabase/server';
import type { ImportParseResult } from '@/lib/importWord';
import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PARSE_TIMEOUT = 60_000; // 60s — Python parsing can be slower on large docs

// Resolve path to the Python script (repo root is one level above physioquiz/)
const SCRIPT_PATH = join(process.cwd(), '..', 'scripts', 'preprocessing_json.py');

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 0. Size limit (early check via header)
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux (max 10 Mo)' },
      { status: 413 },
    );
  }

  // 1. Verify admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  // 2. Read .docx from request body (real size check)
  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux (max 10 Mo)' },
      { status: 413 },
    );
  }

  // 3. Parse via Python preprocessing script
  try {
    const result = await parseWithPython(arrayBuffer);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur de parsing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Python subprocess wrapper
// ---------------------------------------------------------------------------

async function parseWithPython(buffer: ArrayBuffer): Promise<ImportParseResult> {
  // Write to temp file
  const tmpPath = join(tmpdir(), `parse-word-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`);
  await writeFile(tmpPath, Buffer.from(buffer));

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        'python3',
        [SCRIPT_PATH, tmpPath],
        { timeout: PARSE_TIMEOUT, maxBuffer: 50 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            const msg = stderr?.trim() || err.message;
            reject(new Error(`Erreur preprocessing: ${msg}`));
          } else {
            resolve(stdout);
          }
        },
      );
    });

    // Parse JSON output
    const result = JSON.parse(stdout);

    // Check if the script returned an error
    if (result.error) {
      throw new Error(result.error);
    }

    return result as ImportParseResult;
  } finally {
    // Clean up temp file
    await unlink(tmpPath).catch(() => {});
  }
}
