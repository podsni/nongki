import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader, BottomNav } from "@/components/Nav";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Nongki — Tempat ngopi & nongkrong + cek WiFi", template: "%s · Nongki" },
  description: "Rekomendasi tempat ngopi & nongkrong lengkap dengan kecepatan internet, daftar WiFi, dan password-nya.",
  applicationName: "Nongki",
};

export const viewport: Viewport = { themeColor: "#2b1a12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        <SiteHeader />
        <div className="pb-24 md:pb-0">{children}</div>
        <footer className="hidden border-t border-line py-8 text-center text-sm text-ink-500 md:block">
          Nongki · Diseduh di Malang · Data tempat bertanda <span className="font-semibold">Contoh</span> hanya ilustrasi
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
