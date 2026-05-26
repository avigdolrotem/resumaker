/**
 * POST /api/hr/jobs/bulk-import
 *
 * Accepts multipart CSV upload. Parses rows with columns:
 *   title, company, location, description, remote, seniority, applyUrl
 *
 * Creates jobs in batch with source='hr' + hrUserId + companyId (if provided).
 * Returns { imported: number, errors: string[] }.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { auditEvent } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';

interface CsvRow {
  title: string;
  company: string;
  location?: string;
  description: string;
  remote?: string;
  seniority?: string;
  applyUrl?: string;
  companyId?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row as unknown as CsvRow;
  });
}

function validateRow(row: CsvRow, idx: number): string | null {
  if (!row.title || row.title.length < 3) return `Row ${idx}: title too short`;
  if (!row.company || row.company.length < 1) return `Row ${idx}: company required`;
  if (!row.description || row.description.length < 50)
    return `Row ${idx}: description must be ≥50 chars`;
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Rate limit: 10 bulk imports per hour per user
  const rl = await checkRateLimit(`hr-bulk-import:${guard.user.id}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterSeconds: rl.resetSeconds },
      { status: 429 },
    );
  }

  let csvText: string;
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    csvText = await (file as File).text();
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Empty or invalid CSV' }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Max 500 rows per import' }, { status: 400 });
  }

  const errors: string[] = [];
  const validRows: typeof rows = [];

  rows.forEach((row, i) => {
    const err = validateRow(row, i + 2);
    if (err) errors.push(err);
    else validRows.push(row);
  });

  if (validRows.length === 0) {
    return NextResponse.json({ imported: 0, errors }, { status: 422 });
  }

  // SECURITY: validate every companyId in the CSV actually belongs to a
  // company this HR user is a member of (or admin). Without this, anyone
  // with role=hr can attach their bulk-imported jobs to ANY company's
  // companyId — attribution-jacking ("Apple is hiring", says random HR).
  const companyIds = Array.from(
    new Set(
      validRows.map((r) => r.companyId).filter((v): v is string => Boolean(v) && v !== 'null'),
    ),
  );
  if (companyIds.length > 0 && guard.user.role !== 'admin') {
    const memberships = await db.query.companyMembers.findMany({
      where: and(
        eq(schema.companyMembers.userId, guard.user.id),
        inArray(schema.companyMembers.companyId, companyIds),
      ),
      columns: { companyId: true },
    });
    const allowedSet = new Set(memberships.map((m) => m.companyId));
    const bad = companyIds.filter((c) => !allowedSet.has(c));
    if (bad.length > 0) {
      return NextResponse.json(
        {
          error: 'CSV references companies you are not a member of',
          unauthorizedCompanyIds: bad,
        },
        { status: 403 },
      );
    }
  }

  const now = Date.now();
  const inserts = validRows.map((row, i) => {
    const internalUrl = row.applyUrl ?? `https://resumaker.co.il/jobs/hr-${guard.user.id}`;
    return {
      externalId: null,
      source: 'hr' as const,
      company: row.company,
      title: row.title,
      location: row.location ?? null,
      description: row.description,
      url: internalUrl,
      urlNormalized: `${internalUrl.toLowerCase()}#${now}-${i}`,
      remote: row.remote === 'true' || row.remote === '1',
      seniority: row.seniority ?? null,
      hrUserId: guard.user.id,
      companyId: row.companyId ?? null,
      postedAt: new Date(),
    };
  });

  await db.insert(schema.jobs).values(inserts);

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_jobs_bulk_imported', count: inserts.length },
  });

  return NextResponse.json({ imported: inserts.length, errors });
}
