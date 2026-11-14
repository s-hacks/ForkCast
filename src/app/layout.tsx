import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ForkCast · Meal Coordination",
  description: "Meal scheduling, volunteer coordination and pantry inventory, built for Firehouse Ministries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        {children}
        <footer className="mt-auto border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
          ForkCast: volunteer coordination for Firehouse Ministries, Birmingham AL. Unofficial design; not an official logo or brand asset.
        </footer>
      </body>
    </html>
  );
}
