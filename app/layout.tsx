import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { GooeyToaster } from "@/features/shell/gooey-toaster";
import "./globals.css";

const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Panel Lokalny",
  description: "Panel do zarządzania lokalną obecnością online",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geist.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden" suppressHydrationWarning>
        {children}
        <GooeyToaster />
      </body>
    </html>
  );
}
