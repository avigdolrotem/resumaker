'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';

type AuthModalMode = 'sign-in' | 'sign-up' | null;

interface AuthModalContextValue {
  /** Opens the auth modal in the given mode from anywhere in the app —
   * e.g. the marketing header's Sign in/Sign up links use this instead
   * of navigating, so the page underneath stays mounted and visible. */
  openAuthModal: (mode: 'sign-in' | 'sign-up') => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

/**
 * Mounted once at the locale root layout (inside NextIntlClientProvider
 * — the forms use useTranslations). Owns the modal's open/closed state
 * and renders <AuthModal> alongside its children; anything inside can
 * call useAuthModal().openAuthModal(...) to open it without needing to
 * pass callbacks down through props.
 *
 * Deliberately NOT built on Next.js intercepting routes (the "correct"
 * way to get a URL-addressable modal-over-the-previous-page). That
 * needs its own @modal parallel-route slot wired into every layout a
 * trigger could live under, with real edge cases around direct-load vs
 * intercepted-load — more moving parts than justified here, and this
 * is the single highest-traffic entry point in the app to get subtly
 * wrong. Plain client state means: if some entry point is never wired
 * up to call openAuthModal, it just falls back to the normal, already-
 * correct <Link href="/sign-in"> full-page navigation — not a broken
 * modal, not a dead link. Same forms either way (SignInForm/SignUpForm
 * are shared with the full-page routes), so there's no behavior to
 * keep in sync between the two.
 */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthModalMode>(null);
  const openAuthModal = useCallback((m: 'sign-in' | 'sign-up') => setMode(m), []);
  const close = useCallback(() => setMode(null), []);

  return (
    <AuthModalContext.Provider value={{ openAuthModal }}>
      {children}
      <AuthModal mode={mode} onClose={close} onSwitch={openAuthModal} />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error('useAuthModal must be used within AuthModalProvider');
  }
  return ctx;
}

function AuthModal({
  mode,
  onClose,
  onSwitch,
}: {
  mode: AuthModalMode;
  onClose: () => void;
  onSwitch: (mode: 'sign-in' | 'sign-up') => void;
}) {
  const t = useTranslations('auth.common');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Escape closes; body scroll locks while open so the page behind
  // doesn't scroll along with the modal content.
  useEffect(() => {
    if (!mode) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mode, onClose]);

  if (!mode || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 py-10"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — the page that was already there stays mounted and
          visible underneath, dimmed and blurred rather than replaced. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="animate-fade-in fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
      />

      <div className="animate-liquid-pop relative z-10 w-full max-w-md">
        {/* Inside the card, per the reason this is a modal at all — a
            floating X in the corner of the *page* read as page chrome;
            here the card IS the whole interaction, so the close
            affordance belongs on it. Plain onClose — no router.back(),
            the page underneath was never left, closing is just hiding
            this overlay. Positive inset (not a negative corner-straddle
            offset) so the button sits fully within the card's own
            bounds instead of floating half outside it. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="glass hover:glass-strong text-foreground ease-snappy absolute end-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96]"
        >
          <X className="h-4 w-4" />
        </button>

        {mode === 'sign-in' ? (
          <SignInForm onSwitchToSignUp={() => onSwitch('sign-up')} onSuccess={onClose} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => onSwitch('sign-in')} onSuccess={onClose} />
        )}
      </div>
    </div>,
    document.body,
  );
}
