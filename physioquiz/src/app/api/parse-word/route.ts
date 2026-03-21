/**
 * Server-side Word document parser for question import.
 *
 * Flow:
 *   1. Auth guard (admin-only)
 *   2. Forward .docx binary to Railway parse server (Flask API)
 *   3. Returns structured JSON ready for the import Edge Function
 */

import { createClient } from '@/lib/supabase/server';
import type { ImportParseResult } from '@/lib/importWord';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PARSE_TIMEOUT = 60_000; // 60s
const PARSE_SERVER_URL = process.env.PARSE_SERVER_URL;
const PARSE_API_KEY = process.env.PARSE_API_KEY;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!PARSE_SERVER_URL || !PARSE_API_KEY) {
    return NextResponse.json(
      { error: 'Parse server not configured' },
      { status: 500 },
    );
  }

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

  // 3. Forward to Railway parse server
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PARSE_TIMEOUT);

    const response = await fetch(`${PARSE_SERVER_URL}/parse-word`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-API-Key': PARSE_API_KEY,
      },
      body: arrayBuffer,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: result.error || `Erreur serveur (${response.status})` },
        { status: response.status },
      );
    }
    return NextResponse.json(result as ImportParseResult);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Délai dépassé pour le parsing (60s)' },
        { status: 504 },
      );
    }
    const message =
      err instanceof Error &&
      (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed'))
        ? 'Le serveur de parsing est temporairement indisponible. Réessayez dans quelques minutes.'
        : err instanceof Error
          ? err.message
          : 'Erreur de parsing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
