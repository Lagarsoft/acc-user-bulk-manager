"use client";

import posthog from "posthog-js";

/**
 * analytics.ts — thin client-side wrapper around posthog-js.
 *
 * All components import from here so the underlying library can be swapped
 * without touching every callsite. Calls are silently dropped when PostHog
 * has not been initialised (e.g. missing API key in local dev).
 */

const APP = process.env.NEXT_PUBLIC_POSTHOG_APP;

export function trackEvent(
  name: string,
  props?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.capture(name, { ...(APP ? { app: APP } : {}), ...props });
}

export function identifyUser(
  email: string,
  props?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.identify(email, props);
}

export function resetUser(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
}
