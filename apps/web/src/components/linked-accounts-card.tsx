'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Unlink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Linked accounts (Google/GitHub OAuth) management.
 *
 * Reads providers from /api/account/linked, offers a "Link" button per
 * not-yet-linked provider, and an "Unlink" button per linked one. The
 * unlink call is fresh-session gated server-side — a stale-session
 * 401 surfaces here as a toast prompting the user to sign in again.
 *
 * Currently exposed providers are Google + GitHub (matches the auth.ts
 * `socialProviders` block). Adding another (e.g. LinkedIn, Apple)
 * means adding it to: env vars, socialProviders config, AND the
 * PROVIDER_META map below.
 */

type LinkedAccount = {
  providerId: string;
  accountId: string;
  linkedAt: string;
};

type LinkedAccountsData = {
  hasPassword: boolean;
  oauth: LinkedAccount[];
};

const PROVIDER_META: Record<
  'google' | 'github',
  { label: string; bgClass: string; iconColor: string; svg: React.ReactNode }
> = {
  google: {
    label: 'Google',
    bgClass: 'bg-white dark:bg-card border border-border',
    iconColor: 'text-foreground',
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  github: {
    label: 'GitHub',
    bgClass: 'bg-neutral-900 dark:bg-neutral-100',
    iconColor: 'text-white dark:text-neutral-900',
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.1.79-.25.79-.55v-2.13c-3.2.7-3.88-1.36-3.88-1.36-.53-1.36-1.3-1.72-1.3-1.72-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.73 1.27 3.39.97.1-.75.4-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18A11.05 11.05 0 0 1 12 6.8c.98 0 1.97.13 2.9.4 2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.73.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.15v3.18c0 .31.21.66.79.55 4.57-1.53 7.86-5.84 7.86-10.92C23.5 5.65 18.35.5 12 .5z" />
      </svg>
    ),
  },
};

export function LinkedAccountsCard() {
  const [data, setData] = useState<LinkedAccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/account/linked');
      if (res.ok) setData(await res.json());
    } catch {
      // ignore — UI shows empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleLink(provider: 'google' | 'github') {
    // Better Auth's linkSocial redirects to the provider; the callback
    // brings the user back to `callbackURL` with the link complete.
    await authClient.linkSocial({
      provider,
      callbackURL: '/settings?tab=security',
    });
  }

  async function handleUnlink(providerId: 'google' | 'github') {
    setUnlinkingProvider(providerId);
    try {
      const res = await fetch('/api/account/linked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === 'STALE_SESSION') {
          toast.error('Please sign in again to unlink this account.');
        } else if (json.code === 'LAST_LOGIN_METHOD') {
          toast.error(json.error ?? 'You need to set a password before unlinking.');
        } else {
          toast.error(json.error ?? 'Could not unlink');
        }
        return;
      }
      toast.success(`${PROVIDER_META[providerId].label} unlinked`);
      await refresh();
    } finally {
      setUnlinkingProvider(null);
    }
  }

  const linkedProviders = new Set(data?.oauth.map((a) => a.providerId) ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Linked accounts
        </CardTitle>
        <CardDescription>
          Sign in with one click using Google or GitHub. You can link multiple — useful when your
          work email differs from your personal one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-muted h-14 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          (['google', 'github'] as const).map((provider) => {
            const meta = PROVIDER_META[provider];
            const linkedAcc = data?.oauth.find((a) => a.providerId === provider);
            const isLinked = linkedProviders.has(provider);
            return (
              <div
                key={provider}
                className="border-border bg-card flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${meta.bgClass} ${meta.iconColor}`}
                  >
                    {meta.svg}
                  </div>
                  <div className="min-w-0">
                    <div className="text-foreground text-sm font-medium">{meta.label}</div>
                    <div className="text-muted-foreground text-xs">
                      {isLinked && linkedAcc ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Linked
                          {linkedAcc.linkedAt &&
                            ` · ${new Date(linkedAcc.linkedAt).toLocaleDateString()}`}
                        </span>
                      ) : (
                        'Not linked'
                      )}
                    </div>
                  </div>
                </div>
                {isLinked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleUnlink(provider)}
                    disabled={unlinkingProvider === provider}
                  >
                    <Unlink className="me-1.5 h-3.5 w-3.5" />
                    {unlinkingProvider === provider ? 'Unlinking…' : 'Unlink'}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void handleLink(provider)}>
                    <Link2 className="me-1.5 h-3.5 w-3.5" />
                    Link
                  </Button>
                )}
              </div>
            );
          })
        )}

        {!loading && data && !data.hasPassword && data.oauth.length > 0 && (
          // If the user only has OAuth links (no password) we warn them.
          // Unlinking ALL providers in that case would lock them out;
          // the API also rejects that, but the warning helps users
          // proactively set a password.
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              You don&apos;t have a password set. Add one in the security section above before
              unlinking your only OAuth provider — otherwise you&apos;ll be locked out.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
