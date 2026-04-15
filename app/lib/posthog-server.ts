import { PostHog } from "posthog-node";

/**
 * posthog-server.ts — server-side PostHog helper for Route Handlers.
 *
 * Uses a module-level singleton so the client is reused across warm invocations.
 * flushAt=1 + flushInterval=0 ensure events are dispatched before the
 * serverless function exits without requiring an explicit shutdown call.
 */

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

const APP = process.env.NEXT_PUBLIC_POSTHOG_APP;

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const client = getClient();
  if (!client) return;
  client.capture({ distinctId, event, properties: { ...(APP ? { app: APP } : {}), ...properties } });
  await client.flush();
}
