import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Arcane Telemetry VTT",
  description: "Hybrid Local-First Virtual Tabletop RPG Platform",
};

import { AuthProvider } from "@/lib/AuthContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-text-base h-screen overflow-hidden`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
