'use client';

import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Button } from './ui/button';

interface Props {
  /** Whether to show Google button. Server tells us based on env. */
  showGoogle: boolean;
  /** Whether to show GitHub button. */
  showGitHub: boolean;
  /** Where to redirect after OAuth completes. */
  callbackURL?: string;
}

export function OAuthButtons({ showGoogle, showGitHub, callbackURL = '/dashboard' }: Props) {
  const t = useTranslations('auth.oauth');
  if (!showGoogle && !showGitHub) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">{t('or')}</span>
        </div>
      </div>

      <div className="grid gap-2">
        {showGoogle && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: 'google', callbackURL })}
          >
            <GoogleIcon /> {t('continueWith', { provider: 'Google' })}
          </Button>
        )}
        {showGitHub && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: 'github', callbackURL })}
          >
            <GitHubIcon /> {t('continueWith', { provider: 'GitHub' })}
          </Button>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
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
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.08 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .31.21.69.83.57A12 12 0 0 0 12 .3z"
      />
    </svg>
  );
}
