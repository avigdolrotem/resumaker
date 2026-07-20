'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter, usePathname } from '@/i18n/navigation';

/**
 * Reads the ?email-change=<outcome> param that
 * /api/account/email-change/confirm redirects here with, shows the
 * matching toast, then strips the param so a refresh doesn't re-fire it.
 *
 * Previously this outcome (success/expired/invalid/conflict/missing-token)
 * was baked into the redirect URL but nothing ever read it — the whole
 * email-change confirmation step was silent either way.
 */
export function EmailChangeStatusToast() {
  const t = useTranslations('settings.security.changeEmail');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const outcome = searchParams.get('email-change');
    if (!outcome) return;

    switch (outcome) {
      case 'success':
        toast.success(t('confirmSuccess'));
        break;
      case 'expired':
        toast.error(t('confirmExpired'));
        break;
      case 'invalid':
        toast.error(t('confirmInvalid'));
        break;
      case 'conflict':
        toast.error(t('confirmConflict'));
        break;
      case 'missing-token':
        toast.error(t('confirmMissingToken'));
        break;
    }

    const params = new URLSearchParams(searchParams);
    params.delete('email-change');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    // Deliberately keyed on the raw param value, not the whole
    // searchParams/router/t objects — this rule isn't enforced in this
    // project's eslint config, so no exhaustive-deps to satisfy, and a
    // narrower key avoids re-running for unrelated param changes.
  }, [searchParams.get('email-change')]);

  return null;
}
