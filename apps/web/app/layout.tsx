import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-inter",
});

// Customer-facing screens never mention BoothQ (CLAUDE.md → Naming), so the
// shared default falls back to the booth's own name; staff pages set their
// own "BoothQ · {booth}" title client-side (see lib/useStaffTitle.ts) and
// the customer page sets its own live title (components/customer/CustomerScreen.tsx).
const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

export const metadata: Metadata = {
  title: boothName,
  description: "Queue management for a live illustration booth.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
