import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetOptions = vi.fn().mockResolvedValue({
  stream: () => ({}),
  ssl: false,
});

const mockConnectorInstance = {
  getOptions: mockGetOptions,
  close: vi.fn(),
};

vi.mock('@google-cloud/cloud-sql-connector', () => ({
  Connector: vi.fn().mockImplementation(() => mockConnectorInstance),
  IpAddressTypes: { PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE', PSC: 'PSC' },
  AuthTypes: { PASSWORD: 'PASSWORD', IAM: 'IAM' },
}));

vi.mock('postgres', () => ({
  default: vi.fn(() => ({ end: vi.fn() })),
}));

import { makeCloudSqlClient } from '../cloudsql';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOptions.mockResolvedValue({ stream: () => ({}), ssl: false });
});

describe('makeCloudSqlClient', () => {
  it('passes instanceConnectionName, ipType=PRIVATE (default), authType=IAM to the connector', async () => {
    const sql = await makeCloudSqlClient({
      instance: 'resumaker-prod:europe-west1:pg',
      iamUser: 'app@resumaker-prod.iam',
      database: 'resumaker',
    });
    expect(sql).toBeDefined();
    // Default ipType is PRIVATE — GKE pods reach Cloud SQL over private VPC IP
    expect(mockGetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceConnectionName: 'resumaker-prod:europe-west1:pg',
        ipType: 'PRIVATE',
        authType: 'IAM',
      }),
    );
  });

  it('passes ipType=PUBLIC when explicitly requested (e.g. Vercel preview)', async () => {
    const sql = await makeCloudSqlClient({
      instance: 'resumaker-dev:europe-west1:pg',
      iamUser: 'app@resumaker-dev.iam',
      database: 'resumaker',
      ipType: 'PUBLIC',
    });
    expect(sql).toBeDefined();
    expect(mockGetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        ipType: 'PUBLIC',
        authType: 'IAM',
      }),
    );
  });
});
