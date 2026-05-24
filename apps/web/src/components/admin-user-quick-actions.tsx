'use client';

/**
 * Quick-action buttons for the admin user detail page.
 * Handles impersonate, resend verification, force password reset,
 * cancel subscription, and refund.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  userId: string;
  subscription: {
    provider: string;
    status: string;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export function AdminUserQuickActions({ userId, subscription }: Props) {
  const [status, setStatus] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  async function post(url: string, body?: Record<string, unknown>) {
    const init: RequestInit = body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : { method: 'POST' };
    const res = await fetch(url, init);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? 'Error');
  }

  async function handleImpersonate() {
    try {
      setStatus('Starting impersonation…');
      await post(`/api/admin/users/${userId}/impersonate`);
      setStatus('Impersonation session created. Reload to switch context.');
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  async function handleResendVerification() {
    try {
      setStatus('Sending verification email…');
      await post(`/api/admin/users/${userId}/resend-verification`);
      setStatus('Verification email sent.');
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  async function handleForcePasswordReset() {
    try {
      setStatus('Sending password reset…');
      await post(`/api/admin/users/${userId}/force-password-reset`);
      setStatus('Password reset email sent.');
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  async function handleCancelSub() {
    if (!confirm('Cancel this user\'s subscription at period end?')) return;
    try {
      setStatus('Canceling subscription…');
      await post(`/api/admin/users/${userId}/subscription/cancel`);
      setStatus('Subscription set to cancel at period end.');
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  async function handleRefund() {
    const cents = Number(refundAmount);
    if (!cents || isNaN(cents)) {
      setStatus('Enter a valid amount in cents.');
      return;
    }
    if (!confirm(`Issue refund of ${cents} cents?`)) return;
    try {
      setStatus('Issuing refund…');
      await post(`/api/admin/users/${userId}/subscription/refund`, { amountCents: cents });
      setStatus(`Refund of ${cents} cents issued.`);
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleImpersonate()}>
            Impersonate
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleResendVerification()}>
            Resend verification
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleForcePasswordReset()}>
            Force password reset
          </Button>
          {subscription && !subscription.cancelAtPeriodEnd && (
            <Button size="sm" variant="outline" onClick={() => void handleCancelSub()}>
              Cancel subscription
            </Button>
          )}
        </div>

        {subscription?.provider === 'stripe' && (
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="refund-amount" className="text-xs">
                Refund amount (cents)
              </Label>
              <Input
                id="refund-amount"
                type="number"
                min={1}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="e.g. 3900"
                className="w-40"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => void handleRefund()}>
              Issue refund
            </Button>
          </div>
        )}

        {status && <p className="text-sm text-neutral-600">{status}</p>}
      </CardContent>
    </Card>
  );
}
