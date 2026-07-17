'use client';

import { useEffect, useRef } from 'react';

/**
 * Wraps a Next.js client navigation in the browser's native View
 * Transitions API so an element sharing a `viewTransitionName` (set via
 * inline `style` — see resume-grid.tsx / resume-preview.tsx) morphs
 * between the source and destination page instead of hard-cutting.
 * First use: the dashboard resume card → builder preview-card
 * transition, in both directions.
 *
 * Falls back to a plain navigation when the API isn't supported
 * (Firefox, older Safari) or the user has `prefers-reduced-motion:
 * reduce` set — in both cases `navigateWithViewTransition` is a no-op
 * wrapper around whatever `navigate()` you pass it, so call sites don't
 * need their own feature-detection.
 *
 * The tricky part: `document.startViewTransition(callback)` wants
 * `callback` to resolve once the DOM reflects its final "after" state.
 * Next's client-side navigation is async (fetch + render), so the
 * destination page must call `signalViewTransitionReady()` (via the
 * `useSignalViewTransitionReady` hook below) once it has real content
 * on screen — otherwise the browser would snapshot too early and morph
 * into a loading skeleton instead of the finished page. A safety
 * timeout resolves anyway so a page that forgets the signal, or a
 * transition started outside this flow, never hangs navigation.
 *
 * Second tricky part, found while testing this prototype with scripted
 * rapid-fire navigation (a burst of screenshots immediately followed by
 * a "click back" — much faster than a human, but a real double-click or
 * a fast back-and-forth is a plausible real case too): calling
 * `document.startViewTransition()` again while a previous transition is
 * still active/finishing raced with it and could leave the click
 * appearing to do nothing. Fixed by tracking the in-flight transition
 * and explicitly `skipTransition()`-ing it before starting the next one
 * instead of letting two overlap.
 */

let activeTransition: ViewTransition | null = null;
let pendingResolve: (() => void) | null = null;

/** Module-level singleton is fine — only one navigation is ever in flight in a tab. */
export function signalViewTransitionReady() {
  pendingResolve?.();
  pendingResolve = null;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function navigateWithViewTransition(navigate: () => void) {
  if (typeof document === 'undefined' || !document.startViewTransition || prefersReducedMotion()) {
    navigate();
    return;
  }

  const start = () => {
    // Drop any leftover resolver from an interrupted prior transition
    // (e.g. the user double-clicked two cards) so it can't fire late
    // into this one.
    pendingResolve = null;
    const transition = document.startViewTransition!(
      () =>
        new Promise<void>((resolve) => {
          pendingResolve = resolve;
          navigate();
          // Never let a forgotten signal hang the transition indefinitely.
          setTimeout(() => {
            if (pendingResolve === resolve) {
              pendingResolve = null;
              resolve();
            }
          }, 1500);
        }),
    );
    activeTransition = transition;
    void transition.finished.finally(() => {
      if (activeTransition === transition) activeTransition = null;
    });
  };

  if (activeTransition) {
    // A previous transition hasn't finished yet — skip it immediately
    // rather than let this call's startViewTransition() race with it.
    activeTransition.skipTransition();
    void activeTransition.finished.finally(start);
  } else {
    start();
  }
}

/**
 * Call from a navigation *destination* once its real content (not a
 * loading skeleton) is on screen, so an in-flight view transition knows
 * it can take its "after" snapshot now. Safe to call unconditionally —
 * it's a no-op when there's no pending transition (e.g. a direct visit,
 * or this page wasn't reached via `navigateWithViewTransition`).
 */
export function useSignalViewTransitionReady(ready: boolean) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!ready || firedRef.current) return;
    firedRef.current = true;
    // Call directly — no requestAnimationFrame. `useEffect` already runs
    // after React has committed the DOM, which is all the transition's
    // "new" snapshot needs (it's computed from current layout/styles,
    // not a literal paint). rAF looked safer but isn't: the browser
    // throttles rAF while a view-transition callback promise is still
    // pending (no new frame needs compositing while the old snapshot is
    // frozen), so a rAF-wrapped signal can stall for the better part of
    // a second — found by tracing why "ready" fired but the transition
    // still hung until the safety timeout bailed it out.
    signalViewTransitionReady();
  }, [ready]);
}
