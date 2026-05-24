/**
 * POST /api/tools/ats-scanner
 *
 * Public tool — no auth required. Rate-limited 10/hr/IP.
 * Scores a resume text against a job description.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const Body = z.object({
  jobDescription: z.string().min(50).max(10_000),
  resumeText: z.string().min(50).max(10_000),
});

export async function POST(req: NextRequest): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit(`tools:ats:${ip}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input. Provide jobDescription and resumeText.' }, {
      status: 400,
    });
  }

  const prompt = `You are an ATS (Applicant Tracking System) analyzer.

JOB DESCRIPTION:
${body.jobDescription.slice(0, 3000)}

RESUME TEXT:
${body.resumeText.slice(0, 3000)}

Analyze how well the resume matches the job description.

Respond with ONLY a JSON object (no markdown):
{
  "score": <integer 0-100>,
  "matched": [<list of matched keywords/skills, max 15 strings>],
  "missing": [<list of important missing keywords, max 15 strings>],
  "summary": "<2-3 sentence summary of the match quality>"
}`;

  try {
    const response = await client.messages.create({
      model: env.FALLBACK_LLM_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const result = JSON.parse(jsonMatch[0]) as {
      score: number;
      matched: string[];
      missing: string[];
      summary: string;
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Scan failed. Please try again.' },
      { status: 500 },
    );
  }
}
