'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CouponRow {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  notes: string | null;
  createdAt: string;
}

export default function AdminCouponsPage() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/admin/coupons')
      .then((r) => r.json())
      .then((d: { rows: CouponRow[] }) => setRows(d.rows ?? []));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          discountPercent: Number(discountPercent),
          usageLimit: usageLimit ? Number(usageLimit) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const data = (await res.json()) as { row: CouponRow; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to create');
        return;
      }
      setRows((prev) => [data.row, ...prev]);
      setCode('');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`Delete coupon ${code}?`)) return;
    await fetch(`/api/admin/coupons/${code}`, { method: 'DELETE' });
    setRows((prev) => prev.filter((r) => r.code !== code));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Coupons</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create coupon</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUMMER25"
                maxLength={40}
                required
              />
            </div>
            <div>
              <Label htmlFor="discount">Discount %</Label>
              <Input
                id="discount"
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="limit">Usage limit (optional)</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <Label htmlFor="expires">Expires at (optional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving} className="col-span-2 sm:col-span-1">
              {saving ? 'Creating…' : 'Create coupon'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="glass-subtle overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">All coupons</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No coupons yet.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Coupons list</caption>
              <thead className="text-muted-foreground text-start text-xs uppercase">
                <tr className="border-border border-b">
                  <th scope="col" className="pb-2 font-medium">
                    Code
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Discount
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Used / Limit
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Expires
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-2 font-mono font-medium">{row.code}</td>
                    <td className="py-2">{row.discountPercent}%</td>
                    <td className="py-2">
                      {row.usageCount} / {row.usageLimit ?? '∞'}
                    </td>
                    <td className="text-muted-foreground py-2 text-xs" dir="ltr">
                      {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDelete(row.code)}
                        className="text-red-600 dark:text-red-400"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </div>
    </div>
  );
}
