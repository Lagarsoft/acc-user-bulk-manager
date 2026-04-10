import type { Hub } from "@/app/lib/acc-admin";
import { getTwoLeggedToken } from "@/app/lib/aps-auth";
import { listHubs } from "@/app/lib/acc-admin";
import Dashboard from "@/app/components/Dashboard";

/**
 * Root page — Server Component.
 * Fetches the hub list at request time and hands it to the Dashboard
 * Client Component, which manages all further interactivity.
 */
export default async function Home() {
  let hubs: Hub[] = [];
  let initialError: string | null = null;

  try {
    const token = await getTwoLeggedToken();
    hubs = await listHubs(token);
  } catch (err) {
    initialError = err instanceof Error ? err.message : "Failed to load hubs";
  }

  return <Dashboard initialHubs={hubs} initialError={initialError} />;
}
