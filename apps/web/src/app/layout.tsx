import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuestDreamer — Virtual Tabletop RPG Platform",
  description:
    "A hybrid P2P-powered virtual tabletop for TTRPGs. Create campaigns, build worlds, and play together in real-time.",
  keywords: ["TTRPG", "Virtual Tabletop", "VTT", "RPG", "D&D", "Pathfinder", "WebRTC"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
