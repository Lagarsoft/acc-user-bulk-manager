"use client";

import type { Hub } from "@/app/lib/acc-admin";

interface Props {
  hubs: Hub[];
  selectedHubId: string | null;
  onSelect: (hubId: string) => void;
}

/**
 * HubSelector — renders only when the user belongs to more than one hub.
 * When there is exactly one hub it should be auto-selected by the parent
 * and this component will not be shown.
 */
export default function HubSelector({ hubs, selectedHubId, onSelect }: Props) {
  if (hubs.length <= 1) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <label
        htmlFor="hub-select"
        className="text-sm font-medium text-gray-700 shrink-0"
      >
        Account (hub)
      </label>
      <select
        id="hub-select"
        value={selectedHubId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0696D7] focus:border-transparent"
      >
        <option value="" disabled>
          Select an account…
        </option>
        {hubs.map((hub) => (
          <option key={hub.id} value={hub.id}>
            {hub.name}
            {hub.region && hub.region !== "US" ? ` (${hub.region})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
