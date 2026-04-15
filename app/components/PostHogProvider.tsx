"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * PostHogProvider — initialises posthog-js once on the client.
 *
 * Reads the `aps_user_email` cookie (set by the OAuth callback) to identify
 * the logged-in user. Place this as high as possible in the component tree so
 * identification happens before any child events fire.
 */

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(^| )" + name + "=([^;]+)"),
  );
  return match ? decodeURIComponent(match[2]) : null;
}

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
    });

    const email = getCookie("aps_user_email");
    if (email) {
      posthog.identify(email);
    }
  }, []);

  return <>{children}</>;
}
