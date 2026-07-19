/**
 * POST /api/tools/salary-estimator
 *
 * Public tool — no auth required. Rate-limited 10/hr/IP.
 * Uses Claude Haiku to estimate salary range.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { generateText } from '@/lib/llm/provider';
import { sanitizeInput } from '@resumaker/ai-safety';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractClientIp } from '@/lib/ip';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';
import { hashIp } from '@/lib/audit';

export const runtime = 'nodejs';

const Body = z.object({
  role: z.string().min(1).max(200),
  years: z.number().int().min(0).max(50),
  location: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const ip = extractClientIp(req);
  // Hashed, not raw — see the matching comment in tools/ats-scanner/route.ts.
  const rl = await checkRateLimit(`tools:salary:${hashIp(ip) ?? ip}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Sanitize the free-text fields so an attacker can't inject prompt
  // tags into the Claude request. `years` is a number so it's safe.
  const sanitizedRole = sanitizeInput(body.role);
  const sanitizedLocation = sanitizeInput(body.location);
  const sanitizedIndustry = body.industry ? sanitizeInput(body.industry) : null;
  if (
    sanitizedRole.rejected ||
    sanitizedLocation.rejected ||
    (sanitizedIndustry && sanitizedIndustry.rejected)
  ) {
    return NextResponse.json({ error: 'Input contains suspicious content.' }, { status: 400 });
  }

  const prompt = `You are a compensation analyst for the Israeli tech market.

Given this job profile, provide a realistic salary range:
- Role: ${sanitizedRole.cleaned}
- Years of experience: ${body.years}
- Location: ${sanitizedLocation.cleaned}
- Industry: ${sanitizedIndustry?.cleaned ?? 'tech'}

Respond with ONLY a JSON object (no markdown):
{
  "min": <number in ILS per month>,
  "max": <number in ILS per month>,
  "currency": "₪",
  "rationale": "<2-3 sentence explanation in the language of the input>"
}`;

  try {
    const response = await generateText({
      model: env.FALLBACK_LLM_MODEL,
      prompt,
      // Was 256 and silently truncating every request — see the ATS
      // scanner route for the full explanation (Gemini 2.5's default-on
      // "thinking" spends the output-token budget on invisible
      // reasoning before any visible text). disableThinking is the real
      // fix; 512 is just headroom for the visible JSON + ```json fence.
      maxOutputTokens: 512,
      disableThinking: true,
    });

    // Strip a ```json ... ``` (or bare ```) fence if present — models
    // occasionally wrap structured output in one despite an explicit
    // "no markdown" instruction.
    const text = (response.text || '{}').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const result = JSON.parse(jsonMatch[0]) as {
      min: number;
      max: number;
      currency: string;
      rationale: string;
    };

    return NextResponse.json(result);
  } catch (err) {
    logger.error(
      { err: (err as Error).message, ipHash: hashIp(ip) },
      'tools.salary_estimator.failed',
    );
    return NextResponse.json(
      { error: 'Failed to estimate salary. Please try again.' },
      { status: 500 },
    );
  }
}
