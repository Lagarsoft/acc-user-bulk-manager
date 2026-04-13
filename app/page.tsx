import { cookies } from "next/headers";
import type { Hub } from "@/app/lib/acc-admin";
import { COOKIE_ACCESS_TOKEN } from "@/app/lib/aps-auth";
import { listHubs } from "@/app/lib/acc-admin";
import Dashboard from "@/app/components/Dashboard";

/**
 * Root page — Server Component.
 * Fetches the hub list using the 3-legged token from the session cookie.
 * If the user is not logged in, hubs will be empty and the Dashboard
 * will prompt them to authenticate.
 */
export default async function Home() {
  let hubs: Hub[] = [];
  let initialError: string | null = null;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (token) {
    try {
      hubs = await listHubs(token);
    } catch (err) {
      initialError = err instanceof Error ? err.message : "Failed to load hubs";
    }
  }

  return <Dashboard initialHubs={hubs} initialError={initialError} />;
}
