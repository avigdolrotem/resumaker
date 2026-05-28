import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// `redis` is a network client — mocking it is unavoidable for a unit test.
// We assert on the *options* passed to createClient and on fail-closed timing.
const { createClientMock, connectMock, evalMock, onMock, destroyMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  connectMock: vi.fn(),
  evalMock: vi.fn(),
  onMock: vi.fn(),
  destroyMock: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: (opts: unknown) => createClientMock(opts),
}));

import { checkRateLimit } from '../rate-limit';

type SocketOpts = {
  tls?: boolean;
  ca?: string;
  rejectUnauthorized?: boolean;
  connectTimeout?: number;
};

const g = globalThis as unknown as { _redis?: unknown };

function lastSocket(): SocketOpts {
  const opts = createClientMock.mock.calls.at(-1)?.[0] as { socket?: SocketOpts } | undefined;
  return opts?.socket ?? {};
}

beforeEach(() => {
  vi.clearAllMocks();
  g._redis = null;
  process.env.REDIS_URL = 'rediss://10.130.0.4:6378';
  delete process.env.REDIS_CA_CERT;
  // Keep the connect bound tiny so the fail-closed-fast test is quick.
  process.env.REDIS_CONNECT_TIMEOUT_MS = '50';
  connectMock.mockResolvedValue(undefined);
  evalMock.mockResolvedValue([1, 60]);
  createClientMock.mockImplementation(() => ({
    on: onMock,
    connect: connectMock,
    eval: evalMock,
    destroy: destroyMock,
  }));
});

afterEach(() => {
  g._redis = null;
  delete process.env.REDIS_CONNECT_TIMEOUT_MS;
});

describe('checkRateLimit', () => {
  it('fails closed (blocks) and never builds a client when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    const r = await checkRateLimit('k', 10, 60);
    expect(r.allowed).toBe(false);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('enables TLS for a rediss:// url', async () => {
    await checkRateLimit('k', 10, 60);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(lastSocket().tls).toBe(true);
  });

  it('skips CA verification on the private link when no CA is provided (so the Google-managed CA does not block)', async () => {
    await checkRateLimit('k', 10, 60);
    expect(lastSocket().rejectUnauthorized).toBe(false);
  });

  it('pins the CA when REDIS_CA_CERT is set, and does NOT disable verification', async () => {
    const ca = '-----BEGIN CERTIFICATE-----\nMIIC\n-----END CERTIFICATE-----';
    process.env.REDIS_CA_CERT = ca;
    await checkRateLimit('k', 10, 60);
    const s = lastSocket();
    expect(s.tls).toBe(true);
    expect(s.ca).toBe(ca);
    expect(s.rejectUnauthorized).not.toBe(false);
  });

  it('sets a bounded connectTimeout', async () => {
    await checkRateLimit('k', 10, 60);
    expect(typeof lastSocket().connectTimeout).toBe('number');
    expect(lastSocket().connectTimeout).toBeLessThanOrEqual(3000);
  });

  it('fails closed FAST (does not hang) when the connection stalls', async () => {
    connectMock.mockImplementation(() => new Promise(() => {})); // never resolves
    const start = Date.now();
    const r = await checkRateLimit('k', 10, 60);
    expect(r.allowed).toBe(false);
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it('does NOT enable TLS for a plain redis:// url', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    await checkRateLimit('k', 10, 60);
    expect(lastSocket().tls).toBeFalsy();
  });

  it('allows under the limit and returns metadata on the happy path', async () => {
    evalMock.mockResolvedValue([3, 42]);
    const r = await checkRateLimit('k', 10, 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(7);
    expect(r.resetSeconds).toBe(42);
  });

  it('blocks when the count exceeds the limit', async () => {
    evalMock.mockResolvedValue([11, 30]);
    const r = await checkRateLimit('k', 10, 60);
    expect(r.allowed).toBe(false);
  });

  it('fails closed when the eval script throws', async () => {
    evalMock.mockRejectedValue(new Error('boom'));
    const r = await checkRateLimit('k', 10, 60);
    expect(r.allowed).toBe(false);
  });
});
