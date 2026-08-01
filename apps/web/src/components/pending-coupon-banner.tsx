'use client';

import { useEffect, useState } from 'react';
import { Tag, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { clearPendingCoupon, readPendingCoupon } from '@/lib/pending-coupon';

/**
 * Closes the loop on a promo code picked up before signing up.
 *
 * Someone arriving from `?coupon=LAUNCH25` can't use it until they have
 * an account, and signup drops them here — not back on /pricing, which
 * is the only place a code can be applied. Without this the code is
 * saved but invisible, and most people would never think to go back.
 *
 * Deliberately not auto-redirecting anyone to /pricing: landing a brand
 * new user straight on a payment page instead of their dashboard is a
 * worse first impression than a dismissible nudge.
 */
export function PendingCouponBanner({ isHebrew }: { isHebrew: boolean }) {
  // Read on mount, not during render — localStorage doesn't exist during
  // SSR, and reading it inline would desync the server and client trees.
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => setCode(readPendingCoupon()), []);

  if (!code) return null;

  return (
    <Card className="border-brand-200 dark:border-brand-800/60 from-brand-50/40 to-card dark:from-brand-950/30 dark:to-card relative bg-gradient-to-br">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="flex items-center gap-2 text-sm">
          <Tag className="text-brand-500 h-4 w-4 shrink-0" />
          {isHebrew ? (
            <span>
              הקוד <span className="font-semibold">{code}</span> שמור עבורכם — בחרו תוכנית כדי
              להשתמש בו.
            </span>
          ) : (
            <span>
              Your code <span className="font-semibold">{code}</span> is saved — pick a plan to use
              it.
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link href="/pricing">{isHebrew ? 'צפו בתוכניות' : 'View plans'}</Link>
          </Button>
          <button
            type="button"
            onClick={() => {
              clearPendingCoupon();
              setCode(null);
            }}
            aria-label={isHebrew ? 'הסר' : 'Dismiss'}
            className="text-muted-foreground hover:bg-accent/60 hover:text-foreground ease-smooth inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
