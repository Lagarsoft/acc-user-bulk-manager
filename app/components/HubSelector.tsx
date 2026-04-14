"use client";

import type { Hub } from "@/app/lib/acc-admin";

interface Props {
  hubs: Hub[];
  selectedHubId: string | null;
  onSelect: (hubId: string) => void;
  required?: boolean;
}

/**
 * HubSelector — renders only when the user belongs to more than one hub.
 * When there is exactly one hub it should be auto-selected by the parent
 * and this component will not be shown.
 */
export default function HubSelector({ hubs, selectedHubId, onSelect, required }: Props) {
  if (hubs.length <= 1) return null;

  const showRequired = required && !selectedHubId;

  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${showRequired ? "border-red-300" : "border-gray-200"}`}>
      <label
        htmlFor="hub-select"
        className="text-sm font-medium text-gray-700 shrink-0 flex items-center gap-1"
      >
        Account (hub)
        {showRequired && <span className="text-red-500 text-xs font-semibold">*&nbsp;Required</span>}
      </label>
      <select
        id="hub-select"
        value={selectedHubId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0696D7] focus:border-transparent ${showRequired ? "border-red-300 bg-red-50" : "border-gray-300"}`}
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
