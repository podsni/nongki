import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader, BottomNav } from "@/components/Nav";
import { SITE_DESC, SITE_NAME, SITE_TAGLINE, pageMeta } from "@/lib/site";
import { requestBase } from "@/lib/host";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["600", "700"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const base = await requestBase();
  const home = pageMeta({ base, title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESC, path: "/", image: "/og/home.jpg", imageAlt: "Nongki — rekomendasi tempat ngopi lengkap dengan kecepatan WiFi" });
  return {
  ...home,
  metadataBase: new URL(base),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: "%s · Nongki" },
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  category: "food",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2b1a12" },
    { media: "(prefers-color-scheme: dark)", color: "#2b1a12" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        <SiteHeader />
        <div className="pb-24 md:pb-0">{children}</div>
        <footer className="hidden border-t border-line py-8 text-center text-sm text-ink-500 md:block">
          Nongki · Diseduh di Malang · Data tempat & foto dari Google Maps, kecepatan internet dari tes pengunjung
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
