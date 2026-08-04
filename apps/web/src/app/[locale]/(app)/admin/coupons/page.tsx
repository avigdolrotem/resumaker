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

/**
 * `<input type="datetime-local">` yields `YYYY-MM-DDTHH:mm` — no seconds
 * and no timezone — while the API validates with zod's
 * `z.string().datetime()`, which requires full RFC 3339. Every attempt to
 * set an expiry through the UI therefore failed with a bare
 * "Invalid body", and "Never" was the only reachable option.
 */
function toIsoOrUndefined(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function AdminCouponsPage() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editing + deleting state, keyed by code (the API's identifier).
  const [editing, setEditing] = useState<string | null>(null);
  const [editPercent, setEditPercent] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editExpires, setEditExpires] = useState('');
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/admin/coupons')
      .then((r) => r.json())
      .then((d: { rows: CouponRow[] }) => setRows(d.rows ?? []));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Validated here, not left to the input's min/max. Native constraint
    // validation blocks submission before this handler runs, so a
    // previous failure's message stayed on screen and read as if it
    // explained the new attempt.
    if (!code.trim()) {
      setError('Enter a coupon code.');
      return;
    }
    const pct = Number(discountPercent);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      setError('Discount must be a whole number between 1 and 100.');
      return;
    }
    if (usageLimit && (!Number.isInteger(Number(usageLimit)) || Number(usageLimit) < 1)) {
      setError('Usage limit must be a whole number of 1 or more.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          discountPercent: Number(discountPercent),
          usageLimit: usageLimit ? Number(usageLimit) : undefined,
          expiresAt: toIsoOrUndefined(expiresAt),
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

  // In-app confirmation rather than window.confirm(). The native dialog
  // is inconsistent with the confirm-in-place pattern used elsewhere
  // (see HrJobCloseButton) and is unreachable to anything driving the
  // browser, which made deletion untestable.
  async function handleDelete(code: string) {
    setRowBusy(code);
    setRowError('');
    try {
      const res = await fetch(`/api/admin/coupons/${code}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRowError(data.error ?? `Could not delete ${code}.`);
        return;
      }
      setRows((prev) => prev.filter((r) => r.code !== code));
      setConfirmingDelete(null);
    } finally {
      setRowBusy(null);
    }
  }

  function startEdit(row: CouponRow) {
    setEditing(row.code);
    setRowError('');
    setEditPercent(String(row.discountPercent));
    setEditLimit(row.usageLimit === null ? '' : String(row.usageLimit));
    // datetime-local wants `YYYY-MM-DDTHH:mm` with no zone or seconds.
    setEditExpires(row.expiresAt ? new Date(row.expiresAt).toISOString().slice(0, 16) : '');
  }

  async function handleSaveEdit(code: string) {
    const pct = Number(editPercent);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      setRowError('Discount must be a whole number between 1 and 100.');
      return;
    }
    setRowBusy(code);
    setRowError('');
    try {
      const res = await fetch(`/api/admin/coupons/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountPercent: pct,
          // null clears the field; undefined would leave it untouched.
          usageLimit: editLimit ? Number(editLimit) : null,
          expiresAt: editExpires ? new Date(editExpires).toISOString() : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRowError(data.error ?? 'Could not save changes.');
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.code === code
            ? {
                ...r,
                discountPercent: pct,
                usageLimit: editLimit ? Number(editLimit) : null,
                expiresAt: editExpires ? new Date(editExpires).toISOString() : null,
              }
            : r,
        ),
      );
      setEditing(null);
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Coupons</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create coupon</CardTitle>
        </CardHeader>
        <CardContent>
          {/* noValidate: the browser's own constraint validation blocked
              submit before handleCreate could run, so an out-of-range
              percentage produced no in-app message at all — and whatever
              error was already on screen stayed there, reading as if it
              explained the new attempt. min/max stay on the inputs for
              their semantics; the checks in handleCreate are what
              actually report. */}
          <form
            noValidate
            onSubmit={(e) => void handleCreate(e)}
            className="grid gap-4 sm:grid-cols-2"
          >
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
                {rows.map((row) =>
                  editing === row.code ? (
                    <tr key={row.id} className="bg-accent/30">
                      <td className="py-2 font-mono font-medium">{row.code}</td>
                      <td className="py-2">
                        <Input
                          aria-label={`Discount percent for ${row.code}`}
                          type="number"
                          min={1}
                          max={100}
                          value={editPercent}
                          onChange={(e) => setEditPercent(e.target.value)}
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          aria-label={`Usage limit for ${row.code}`}
                          type="number"
                          min={1}
                          value={editLimit}
                          onChange={(e) => setEditLimit(e.target.value)}
                          placeholder="∞"
                          className="h-8 w-24"
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          aria-label={`Expiry for ${row.code}`}
                          type="datetime-local"
                          value={editExpires}
                          onChange={(e) => setEditExpires(e.target.value)}
                          className="h-8"
                          dir="ltr"
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={rowBusy === row.code}
                            onClick={() => void handleSaveEdit(row.code)}
                          >
                            {rowBusy === row.code ? 'Saving…' : 'Save'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                        {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
                      </td>
                    </tr>
                  ) : (
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
                        {confirmingDelete === row.code ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              Delete {row.code}?
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={rowBusy === row.code}
                              onClick={() => void handleDelete(row.code)}
                            >
                              {rowBusy === row.code ? 'Deleting…' : 'Delete'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmingDelete(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRowError('');
                                setConfirmingDelete(row.code);
                              }}
                              className="text-red-600 dark:text-red-400"
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                        {confirmingDelete === row.code && rowError && (
                          <p className="mt-1 text-xs text-red-600">{rowError}</p>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </div>
    </div>
  );
}
