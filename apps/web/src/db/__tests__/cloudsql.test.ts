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
  it('passes instanceConnectionName, ipType=PUBLIC, authType=IAM to the connector', async () => {
    const sql = await makeCloudSqlClient({
      instance: 'resumaker-prod:europe-west1:pg',
      iamUser: 'app@resumaker-prod.iam',
      database: 'resumaker',
    });
    expect(sql).toBeDefined();
    // getOptions is called with the right args regardless of connector reuse
    expect(mockGetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceConnectionName: 'resumaker-prod:europe-west1:pg',
        ipType: 'PUBLIC',
        authType: 'IAM',
      }),
    );
  });
});
