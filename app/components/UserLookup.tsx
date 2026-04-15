"use client";

import { useState, useRef } from "react";
import type { AccountUser } from "@/app/lib/acc-admin";

interface Props {
  accountId: string | null;
}

/**
 * UserLookup — search Forma account users by name or email and copy their email.
 *
 * Shown in the Step 0 sidebar so users can find emails while building
 * their CSV without leaving the app.
 */
export default function UserLookup({ accountId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim() || !accountId) {
      setResults([]);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/users?accountId=${encodeURIComponent(accountId)}&q=${encodeURIComponent(value.trim())}`)
        .then(async (res) => {
          const data: { users?: AccountUser[]; error?: string } = await res.json();
          if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
          setResults(data.users ?? []);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 400);
  }

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">Find user email</h3>

      {!accountId ? (
        <p className="text-xs text-gray-400 py-2">
          Select an account above to search users.
        </p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0696D7] focus:border-transparent"
          />

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2 justify-center">
              <span className="w-4 h-4 border-2 border-[#0696D7] border-t-transparent rounded-full animate-spin" />
              Searching…
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 py-1">{error}</p>
          )}

          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="text-xs text-gray-400 py-2 text-center">
              No users match &ldquo;{query}&rdquo;
            </p>
          )}

          {results.length > 0 && (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 -mx-1">
              {results.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-2 px-1 py-2 hover:bg-gray-50 rounded"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {user.name || `${user.firstName} ${user.lastName}`.trim() || user.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    {user.companyName && (
                      <p className="text-xs text-gray-300 truncate">{user.companyName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => copyEmail(user.email)}
                    title="Copy email"
                    className="shrink-0 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-[#0696D7] hover:text-[#0696D7] transition-colors"
                  >
                    {copiedEmail === user.email ? "Copied!" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
