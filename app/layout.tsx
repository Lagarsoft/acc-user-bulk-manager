import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import Footer from "./components/Footer";
import PostHogProvider from "./components/PostHogProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Forma User Bulk Manager by Lagarsoft",
  description:
    "Bulk-add, remove, or update user permissions across multiple Forma projects via CSV. Built by Lagarsoft — Autodesk Certified Partner.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Forma User Bulk Manager",
    description:
      "Bulk-add, remove, or update user permissions across multiple Forma projects via CSV.",
    siteName: "Lagarsoft",
    url: "https://www.lagarsoft.com",
  },
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
      <body className={`${inter.className} h-screen flex flex-col overflow-hidden`}>
        <PostHogProvider>
        {/* Sticky header */}
        <header className="bg-aps-dark text-white h-14 flex items-center px-6 gap-3 shadow-md sticky top-0 z-50">
          <a
            href="https://www.lagarsoft.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center shrink-0"
            aria-label="Lagarsoft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lagarsoft-logo-square.svg"
              alt="Lagarsoft"
              width={28}
              height={23}
              className="brightness-0 invert"
            />
          </a>
          <div className="w-px h-5 bg-white/20 shrink-0" />
          <span className="font-semibold text-base tracking-tight">Forma User Bulk Manager</span>

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

        <main className="flex-1 overflow-auto">{children}</main>

        <Footer />
        </PostHogProvider>
      </body>
    </html>
  );
}
