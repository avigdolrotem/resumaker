/**
 * POST /api/hr/jobs/bulk-import
 *
 * Accepts multipart CSV upload (RFC-4180 quoting supported — see
 * splitCsvLine). Parses rows with columns:
 *   companyId, title, location, description, remote, seniority, applyUrl
 *
 * `companyId` is REQUIRED per row and must reference a company the
 * caller is a member of; the employer name/slug written to the job are
 * read from that companies row, never from the CSV. There is
 * deliberately no free-text `company` column: when there was one, it
 * was written verbatim to the field users actually read, so the
 * membership check below policed only the invisible DB linkage.
 *
 * Creates jobs in batch with source='hr' + hrUserId + companyId.
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
  /** Required. Employer name/slug are resolved from this, not from the CSV. */
  companyId?: string;
  title: string;
  location?: string;
  description: string;
  remote?: string;
  seniority?: string;
  applyUrl?: string;
}

/**
 * Split one CSV line on commas that are OUTSIDE double quotes, honoring
 * RFC-4180 escaped quotes (`""`). The previous implementation was a bare
 * `line.split(',')` with quotes stripped afterwards, which meant any
 * comma inside a field — i.e. essentially every real job description —
 * shifted every subsequent column by one. Rows either failed the ≥50-char
 * description check or imported mangled, with description fragments
 * landing in `remote`/`seniority`/`applyUrl`.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field.trim());
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

function parseCsv(text: string): CsvRow[] {
  // \r\n tolerated so a file exported from Excel/Sheets on Windows
  // doesn't leave a stray \r on the last column of every row.
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row as unknown as CsvRow;
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateRow(row: CsvRow, idx: number): string | null {
  if (!row.title || row.title.length < 3) return `Row ${idx}: title too short`;
  // companyId (not the free-text `company` column) is now the required
  // field: the displayed employer name is derived from that companies
  // row server-side. Previously `company` was written straight from the
  // CSV, so an HR user could post as "Apple" while the companyId guard
  // below only policed the (invisible) DB linkage — the guard checked
  // the thing users don't see and ignored the thing they do.
  if (!row.companyId || !UUID_RE.test(row.companyId))
    return `Row ${idx}: companyId is required and must be a UUID`;
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
  // validateRow guarantees every row has a UUID companyId by this point.
  const companyIds = Array.from(new Set(validRows.map((r) => r.companyId!)));
  if (guard.user.role !== 'admin') {
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

  // Resolve display identity from the companies rows — never from the
  // CSV. Matches POST /api/hr/jobs, which derives company/companySlug
  // the same way.
  const companyRows = await db.query.companies.findMany({
    where: inArray(schema.companies.id, companyIds),
    columns: { id: true, name: true, slug: true },
  });
  const companyById = new Map(companyRows.map((c) => [c.id, c]));
  const missing = companyIds.filter((id) => !companyById.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'CSV references companies that do not exist', unknownCompanyIds: missing },
      { status: 404 },
    );
  }

  const now = Date.now();
  const inserts = validRows.map((row, i) => {
    const internalUrl = row.applyUrl ?? `https://resumaker.co.il/jobs/hr-${guard.user.id}`;
    const company = companyById.get(row.companyId!)!;
    return {
      externalId: null,
      source: 'hr' as const,
      company: company.name,
      companySlug: company.slug,
      title: row.title,
      location: row.location ?? null,
      description: row.description,
      url: internalUrl,
      urlNormalized: `${internalUrl.toLowerCase()}#${now}-${i}`,
      remote: row.remote === 'true' || row.remote === '1',
      seniority: row.seniority ?? null,
      hrUserId: guard.user.id,
      companyId: company.id,
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
