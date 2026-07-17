'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Building2, CheckCircle2, Loader2, XCircle } from 'lucide-react';
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
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="animate-liquid-pop w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="text-brand-600 h-5 w-5" />
            Company Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'idle' && token && (
            <div className="animate-fade-in space-y-4">
              <p className="text-muted-foreground">
                You have been invited to join a company on Resumaker.
              </p>
              <Button onClick={() => void handleAccept()}>Accept invitation</Button>
            </div>
          )}
          {status === 'loading' && (
            <p className="text-muted-foreground animate-fade-in flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Accepting…
            </p>
          )}
          {status === 'success' && (
            <p className="animate-fade-in flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {message}
            </p>
          )}
          {status === 'error' && (
            <p className="animate-fade-in flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4 shrink-0" />
              {message || 'Invalid or expired invite.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
