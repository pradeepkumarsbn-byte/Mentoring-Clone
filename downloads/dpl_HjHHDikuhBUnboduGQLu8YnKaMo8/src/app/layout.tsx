import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "ISKCON Warangal Mentoring Hub",
  description: "Private mentor summaries, program attendance and invitation eligibility for ISKCON Warangal.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
