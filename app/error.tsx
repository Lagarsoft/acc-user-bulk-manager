"use client";

import { useEffect } from "react";

/**
 * Error boundary for the app router. Next.js renders this whenever a
 * Server or Client Component in the tree throws during render. Having
 * this file also silences the "missing required error components,
 * refreshing…" dev-mode overlay when HMR hits an inconsistent state.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error] unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-full flex items-center justify-center bg-gray-50 px-6 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
        <p className="text-sm text-gray-600">
          An unexpected error occurred. You can retry, or reload the page.
        </p>
        {error?.message && (
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto text-gray-700">
            {error.message}
          </pre>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-[#0696D7] hover:bg-[#0580BC] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="border border-gray-300 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
