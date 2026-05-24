'use client';

/**
 * ImpersonationBanner — shown at the top of every page when the current
 * session was created by an admin via the impersonate API.
 *
 * The session carries `impersonatedBy` in the response from /api/account/me.
 * Usage: render conditionally in the app layout when impersonatedBy is set.
 */

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** The admin who started the impersonation (for display/exit purposes) */
  adminUserId?: string;
  targetUserId: string;
}

export function ImpersonationBanner({ adminUserId: _adminUserId, targetUserId }: Props) {
  const [exiting, setExiting] = useState(false);

  async function handleExit() {
    setExiting(true);
    try {
      await fetch(`/api/admin/users/${targetUserId}/impersonate?exit=1`, {
        method: 'POST',
      });
      // Redirect back to admin panel
      window.location.href = `/admin/users/${targetUserId}`;
    } finally {
      setExiting(false);
    }
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow"
    >
      <span className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        Impersonating user{' '}
        <span className="font-mono text-xs" dir="ltr">
          {targetUserId.slice(0, 8)}…
        </span>
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void handleExit()}
        disabled={exiting}
        className="border-white bg-transparent text-white hover:bg-amber-600"
        aria-label="Exit impersonation"
      >
        {exiting ? 'Exiting…' : 'Exit impersonation'}
      </Button>
    </div>
  );
}
