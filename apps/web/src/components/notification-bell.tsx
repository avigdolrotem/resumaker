'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Header notification bell. Polls /api/notifications every 60s while
 * the page is visible. Click → dropdown with newest 10 + unread count.
 *
 * Lightweight — no websocket, no SSE. Resume builder + job hunt are
 * not chat-volume; 60s freshness is fine.
 */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch('/api/notifications');
        if (!res.ok) return;
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnread(Number(data.unreadCount ?? 0));
      } catch {
        // ignore; bell stays silent
      }
    }

    void load();
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  async function markAllRead() {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
        setUnread(0);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('bellLabel', { count: unread })}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            className="absolute -end-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 p-3">
            <span className="text-sm font-semibold">{t('title')}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('markAllRead')}
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
            {items.length === 0 ? (
              <li className="p-4 text-sm text-neutral-500">{t('empty')}</li>
            ) : (
              items.slice(0, 10).map((n) => {
                const className = `block p-3 text-sm ${n.readAt ? 'text-neutral-500' : 'bg-violet-50/50'}`;
                const inner = (
                  <>
                    <p className={n.readAt ? '' : 'font-semibold'}>{n.title}</p>
                    {n.body && <p className="mt-1 text-xs text-neutral-600">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-neutral-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className={className} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={className}>{inner}</div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
