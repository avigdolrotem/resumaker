/**
 * GET /api/templates → { templates: [{ id, name, description, order, locked }] }
 *
 * Full template catalog for the current user's tier. `locked: true`
 * means the template renders/exports fine (the PDF route never tier-
 * checks templateId — a resume saved under a template you later
 * downgrade from should keep rendering), but the picker shouldn't let
 * a free user select it without hitting the upgrade modal, mirroring
 * how /api/user/llm-model gates model choice.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { TEMPLATES, templatesForTier } from '@resumaker/resume-engine';
import { getUserTier } from '@/lib/billing/tier';

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = await getUserTier(session.user.id);
  const allowedIds = new Set(templatesForTier(tier).map((t) => t.id));

  const templates = Object.values(TEMPLATES)
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      order: t.order,
      locked: !allowedIds.has(t.id),
    }));

  return NextResponse.json({ templates });
}
