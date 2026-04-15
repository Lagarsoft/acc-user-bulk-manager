"use client";

/**
 * LoginCard — shown on /login.
 * Presents the "Sign in with Autodesk" button (links to GET /api/auth/login),
 * a list of permissions the app will request, and an auth disclaimer.
 */
export default function LoginCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md w-full">
      {/* Lagarsoft logo */}
      <a
        href="https://www.lagarsoft.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mx-auto mb-6"
        aria-label="Lagarsoft"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/lagarsoft-logo-square.svg"
          alt="Lagarsoft"
          width="48"
          height="40"
        />
      </a>

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

      <p className="text-xs text-gray-400 mt-4">
        Built by{" "}
        <a
          href="https://www.lagarsoft.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600 transition-colors"
        >
          Lagarsoft
        </a>
        {" "}— Autodesk Certified Partner
      </p>
    </div>
  );
}
