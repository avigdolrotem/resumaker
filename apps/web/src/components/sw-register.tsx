'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only.
 * Must be a client component mounted inside the root layout.
 */
export function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.info('[SW] registered:', registration.scope);
      })
      .catch((err) => {
        console.error('[SW] registration failed:', err);
      });
  }, []);

  return null;
}
