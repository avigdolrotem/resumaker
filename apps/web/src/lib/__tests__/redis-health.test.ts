import { describe, it, expect, vi, beforeEach } from 'vitest';

// `redis` is a network client — mocking is unavoidable. The critical assertion
// is that the one-shot readiness client is ALWAYS destroyed (no socket leak),
// including when the connection stalls past the timeout. That leak (orphaned
// reconnecting clients accumulating every 5s probe) was the HPA money-leak:
// a prod pod with zero traffic held 512 sockets / 558m CPU.
const { createClientMock, connectMock, pingMock, onMock, destroyMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  connectMock: vi.fn(),
  pingMock: vi.fn(),
  onMock: vi.fn(),
  destroyMock: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: (opts: unknown) => createClientMock(opts),
}));

import { checkRedis } from '../redis-health';

function lastSocket(): Record<string, unknown> {
  const opts = createClientMock.mock.calls.at(-1)?.[0] as { socket?: Record<string, unknown> };
  return opts?.socket ?? {};
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REDIS_CA_CERT;
  connectMock.mockResolvedValue(undefined);
  pingMock.mockResolvedValue('PONG');
  createClientMock.mockImplementation(() => ({
    on: onMock,
    connect: connectMock,
    ping: pingMock,
    destroy: destroyMock,
  }));
});

describe('checkRedis', () => {
  it('returns ok with latency when connect + ping succeed', async () => {
    const r = await checkRedis('rediss://10.130.0.4:6378', 1500);
    expect(r.status).toBe('ok');
    expect(typeof r.latencyMs).toBe('number');
  });

  it('destroys the client on the success path (no leak)', async () => {
    await checkRedis('rediss://10.130.0.4:6378', 1500);
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('returns down AND still destroys the client when the connection stalls (the leak fix)', async () => {
    connectMock.mockImplementation(() => new Promise(() => {})); // never resolves
    const start = Date.now();
    const r = await checkRedis('rediss://10.130.0.4:6378', 50);
    expect(r.status).toBe('down');
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('returns down and destroys the client when connect rejects', async () => {
    connectMock.mockRejectedValue(new Error('ECONNRESET'));
    const r = await checkRedis('rediss://10.130.0.4:6378', 1500);
    expect(r.status).toBe('down');
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('enables TLS and skips verification on the private link when no CA is set', async () => {
    await checkRedis('rediss://10.130.0.4:6378', 1500);
    expect(lastSocket().tls).toBe(true);
    expect(lastSocket().rejectUnauthorized).toBe(false);
  });

  it('pins the CA when REDIS_CA_CERT is set', async () => {
    const ca = '-----BEGIN CERTIFICATE-----\nMIIC\n-----END CERTIFICATE-----';
    process.env.REDIS_CA_CERT = ca;
    await checkRedis('rediss://10.130.0.4:6378', 1500);
    expect(lastSocket().ca).toBe(ca);
    expect(lastSocket().rejectUnauthorized).not.toBe(false);
  });
});
