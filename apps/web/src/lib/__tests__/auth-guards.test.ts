import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression tests for the admin API authorization boundary.
 *
 * `requireAdmin` is the single guard every /api/admin/* route handler calls
 * on its first line. The adversarial audit (anon/free/admin × every admin
 * endpoint) proved free=404 / anon=401 / admin=pass at runtime; these tests
 * lock that contract in so a future refactor can't silently open the door.
 * Role is read from the FRESH `users` row (DB), never a cached JWT.
 */
const { getSession, usersFindFirst, dbDelete } = vi.hoisted(() => {
  const dbWhere = vi.fn().mockResolvedValue(undefined);
  return {
    getSession: vi.fn(),
    usersFindFirst: vi.fn(),
    dbDelete: vi.fn(() => ({ where: dbWhere })),
  };
});

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('@/db', () => ({
  db: {
    query: { users: { findFirst: usersFindFirst }, sessions: { findFirst: vi.fn() } },
    delete: dbDelete,
  },
  schema: { users: { id: 'id' }, sessions: { userId: 'userId', id: 'id' } },
}));

import { requireAdmin, requireActiveUser } from '../auth-guards';

const H = () => new Headers();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAdmin — admin API boundary', () => {
  it('401 for an anonymous request (no session)', async () => {
    getSession.mockResolvedValue(null);
    const r = (await requireAdmin(H())) as Response;
    expect(r.status).toBe(401);
  });

  it('401 when the session user no longer exists in the DB', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: 's1' } });
    usersFindFirst.mockResolvedValue(undefined);
    const r = (await requireAdmin(H())) as Response;
    expect(r.status).toBe(401);
  });

  it('404 for a free / non-admin user (does NOT reveal the admin endpoint exists)', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: 's1' } });
    usersFindFirst.mockResolvedValue({ id: 'u1', role: 'user', deletedAt: null });
    const r = (await requireAdmin(H())) as Response;
    expect(r.status).toBe(404);
  });

  it('403 and drops all sessions for a suspended user', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: 's1' } });
    usersFindFirst.mockResolvedValue({ id: 'u1', role: 'suspended', deletedAt: null });
    const r = (await requireAdmin(H())) as Response;
    expect(r.status).toBe(403);
    expect(dbDelete).toHaveBeenCalledTimes(1);
  });

  it('403 for a soft-deleted user (deletedAt set) even if role is admin', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: 's1' } });
    usersFindFirst.mockResolvedValue({ id: 'u1', role: 'admin', deletedAt: new Date() });
    const r = (await requireAdmin(H())) as Response;
    expect(r.status).toBe(403);
  });

  it('passes through for an admin (returns the loaded user, not a Response)', async () => {
    getSession.mockResolvedValue({ user: { id: 'a1' }, session: { id: 's1' } });
    usersFindFirst.mockResolvedValue({ id: 'a1', role: 'admin', deletedAt: null });
    const r = (await requireAdmin(H())) as { user: { role: string } };
    expect(r).not.toBeInstanceOf(Response);
    expect(r.user.role).toBe('admin');
  });
});

describe('requireActiveUser', () => {
  it('401 when anonymous', async () => {
    getSession.mockResolvedValue(null);
    const r = (await requireActiveUser(H())) as Response;
    expect(r.status).toBe(401);
  });

  it('passes a normal active user through', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' }, session: { id: 's1' } });
    usersFindFirst.mockResolvedValue({ id: 'u1', role: 'user', deletedAt: null });
    const r = (await requireActiveUser(H())) as { user: { role: string } };
    expect(r).not.toBeInstanceOf(Response);
    expect(r.user.role).toBe('user');
  });
});
