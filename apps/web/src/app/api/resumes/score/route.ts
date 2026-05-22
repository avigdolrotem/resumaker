/**
 * POST /api/resumes/score
 *
 * Score a resume against a job description.
 * Body: { resume: Resume, jobDescription: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { scoreResume } from '@resumaker/ats-scorer';
import { ResumeSchema } from '@resumaker/shared';

const BodySchema = z.object({
  resume: ResumeSchema,
  jobDescription: z.string().min(10).max(20_000),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const score = scoreResume(body.resume, body.jobDescription);
  return NextResponse.json(score);
}
