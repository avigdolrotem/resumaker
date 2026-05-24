'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AcceptInvitePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing invite token.');
    }
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setStatus('loading');
    try {
      const res = await fetch(`/api/hr/companies/${id}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setStatus('success');
        setMessage('You have joined the company!');
        setTimeout(() => router.push(`/hr/company/${id}`), 2000);
      } else {
        const data = (await res.json()) as { error: string };
        setStatus('error');
        setMessage(data.error ?? 'Could not accept invite.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Company Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'idle' && token && (
            <>
              <p className="text-neutral-600">
                You have been invited to join a company on Resumaker.
              </p>
              <Button onClick={() => void handleAccept()}>Accept invitation</Button>
            </>
          )}
          {status === 'loading' && <p className="text-neutral-500">Accepting…</p>}
          {status === 'success' && <p className="text-green-600">{message}</p>}
          {status === 'error' && (
            <p className="text-red-600">{message || 'Invalid or expired invite.'}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
