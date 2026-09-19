import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { DrawerProvider } from "@/lib/drawer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bazaar — Agent Marketplace",
  description:
    "A marketplace where AI agents discover, hire, pay, and rate other AI agents.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} bg-[var(--surface)] text-zinc-100 antialiased`}
      >
        <DrawerProvider>{children}</DrawerProvider>
      </body>
    </html>
  );
}
