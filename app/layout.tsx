import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ACC User Bulk Manager",
  description: "Bulk-add, remove, or update user permissions across multiple ACC projects via CSV.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAuthenticated = !!cookieStore.get("aps_access_token")?.value;

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Sticky APS dark header — visible on all pages */}
        <header className="bg-aps-dark text-white h-14 flex items-center px-6 gap-4 shadow-md sticky top-0 z-50">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="6" fill="#0696D7" />
            <path
              d="M8 30 L20 10 L32 30"
              stroke="white"
              strokeWidth="3.5"
              strokeLinejoin="round"
              fill="none"
            />
            <path d="M13 22 L27 22" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <span className="font-semibold text-base tracking-tight">ACC User Bulk Manager</span>

          {isAuthenticated && (
            <div className="ml-auto">
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
        </header>

        {children}
      </body>
    </html>
  );
}
