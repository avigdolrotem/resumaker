import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google-cloud/cloud-sql-connector', () => ({
  Connector: vi.fn().mockImplementation(() => ({
    getOptions: vi.fn().mockResolvedValue({
      stream: () => ({}),
      ssl: false,
    }),
  })),
  IpAddressTypes: { PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE', PSC: 'PSC' },
  AuthTypes: { PASSWORD: 'PASSWORD', IAM: 'IAM' },
}));

vi.mock('postgres', () => ({
  default: vi.fn(() => ({ end: vi.fn() })),
}));

import { makeCloudSqlClient } from '../cloudsql';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('makeCloudSqlClient', () => {
  it('passes instanceConnectionName, ipType=PUBLIC, authType=IAM to the connector', async () => {
    const sql = await makeCloudSqlClient({
      instance: 'resumaker-prod:europe-west1:pg',
      iamUser: 'app@resumaker-prod.iam',
      database: 'resumaker',
    });
    expect(sql).toBeDefined();
    const { Connector } = await import('@google-cloud/cloud-sql-connector');
    expect(Connector).toHaveBeenCalled();
    // The first call to getOptions should have IAM auth + PUBLIC ip.
    const inst = (Connector as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(inst.getOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceConnectionName: 'resumaker-prod:europe-west1:pg',
        ipType: 'PUBLIC',
        authType: 'IAM',
      }),
    );
  });
});
