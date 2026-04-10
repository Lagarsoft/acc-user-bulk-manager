"use client";

/**
 * LoginCard — shown on /login.
 * Presents the "Sign in with Autodesk" button (links to GET /api/auth/login),
 * a list of permissions the app will request, and an auth disclaimer.
 */
export default function LoginCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md w-full">
      {/* Autodesk "A" logo */}
      <svg
        className="mx-auto mb-6"
        width="52"
        height="52"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="8" fill="#0696D7" />
        <path
          d="M8 30 L20 10 L32 30"
          stroke="white"
          strokeWidth="3.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M13 22 L27 22" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      </svg>

      <h1 className="text-2xl font-semibold mb-1">Welcome back</h1>
      <p className="text-gray-500 text-sm mb-8">
        Sign in with your Autodesk account to manage ACC project users in bulk.
      </p>

      <a
        href="/api/auth/login"
        className="w-full bg-[#0696D7] hover:bg-[#0580BC] text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        Sign in with Autodesk
      </a>

      <div className="mt-8 text-left bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Permissions requested
        </p>
        <ul className="space-y-1.5 text-xs text-gray-600">
          <li className="flex items-center gap-2">
            <span className="text-green-500 font-bold">✓</span>
            Read ACC hubs and projects
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500 font-bold">✓</span>
            Read and write project user permissions
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500 font-bold">✓</span>
            Read account admin user directory
          </li>
        </ul>
      </div>

      <p className="text-xs text-gray-400 mt-6">
        Your credentials are never stored. Authentication is handled by Autodesk Platform Services
        (APS) OAuth&nbsp;2.0.
      </p>
    </div>
  );
}
