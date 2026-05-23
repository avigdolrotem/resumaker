/**
 * POST /api/profile/import
 *
 * Upload a PDF or TXT resume → returns parsed profile fields.
 * Multipart form-data with field name 'file'.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractText, parseResumeText } from '@/lib/resume-import';
import { PromptInjectionError, LLMError } from '@resumaker/shared';

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Imports are expensive (LLM call) — tighter rate limit
  const rl = await checkRateLimit(`import:user:${session.user.id}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterSeconds: rl.resetSeconds },
      { status: 429 },
    );
  }

  let file: File | null;
  try {
    const form = await req.formData();
    const value = form.get('file');
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded (field name: file)' }, { status: 400 });
  }

  try {
    const text = await extractText(file);
    if (!text.trim()) {
      return NextResponse.json({ error: 'File appears empty or unreadable' }, { status: 400 });
    }
    const profile = await parseResumeText(text);
    return NextResponse.json({ profile, extractedChars: text.length });
  } catch (err) {
    if (err instanceof PromptInjectionError) {
      return NextResponse.json({ error: 'Suspicious content detected in file' }, { status: 400 });
    }
    if (err instanceof LLMError) {
      return NextResponse.json({ error: 'Parser unavailable' }, { status: 502 });
    }
    const msg = (err as Error).message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
