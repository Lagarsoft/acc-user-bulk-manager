import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACC User Bulk Manager",
  description: "Bulk-add, remove, or update user permissions across multiple ACC projects via CSV.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
