import type { Metadata } from "next";
import type { PlaceView } from "./types";
import { fmtMbps, fmtRp } from "./util";

/** URL publik situs (dipakai untuk og:url, og:image, QR story). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nongki-malang.vercel.app").replace(/\/$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/** Domain resmi yang boleh dipakai di link share (selain itu → SITE_URL). Tambah lewat env ALLOWED_HOSTS="a.com,b.com". */
export const ALLOWED_HOSTS = new Set(
  [SITE_HOST, "nongki-malang.vercel.app", "nongki.bangundwir.my.id", ...(process.env.ALLOWED_HOSTS || "").split(",")]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

/** Ubah nilai header Host menjadi base URL yang aman (allowlist → cegah host header injection). */
export function baseUrlFor(rawHost: string | null | undefined, proto?: string | null): string {
  const host = (rawHost || "").split(",")[0].trim().toLowerCase().replace(/\.$/, "");
  if (ALLOWED_HOSTS.has(host)) return `https://${host}`;
  if (process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `${proto === "https" ? "https" : "http"}://${host}`;
  return SITE_URL;
}

export const hostOf = (base: string) => base.replace(/^https?:\/\//, "");
export const SITE_NAME = "Nongki";
export const SITE_TAGLINE = "Tempat ngopi & nongkrong + cek WiFi";
export const SITE_DESC = "Rekomendasi tempat ngopi & nongkrong di Malang, lengkap dengan kecepatan WiFi dari tes nyata, daftar WiFi & password-nya, dan harga Americano.";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const STORY_SIZE = { width: 1080, height: 1920 } as const;

/** Versi gambar (agar cache WhatsApp/FB ikut berganti saat data berubah). */
export function imageVersion(p: Pick<PlaceView, "updatedAt" | "speedCount" | "photoUrl">) {
  let h = 0;
  for (const c of `${p.updatedAt}|${p.speedCount}|${p.photoUrl}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** Metadata lengkap: title, description, canonical, Open Graph (id_ID) & Twitter. */
export function pageMeta({ base = SITE_URL, title, description, path, image, imageAlt }: { base?: string; title: string; description: string; path: string; image: string; imageAlt: string }): Metadata {
  const url = `${base}${path}`;
  const img = { url: image.startsWith("http") ? image : `${base}${image}`, width: OG_SIZE.width, height: OG_SIZE.height, alt: imageAlt, type: "image/jpeg" };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, siteName: SITE_NAME, locale: "id_ID", images: [img] },
    twitter: { card: "summary_large_image", title, description, images: [{ url: img.url, alt: imageAlt }] },
  };
}

/** Ringkasan singkat tempat untuk deskripsi & teks share. */
export function placeFacts(p: PlaceView) {
  const rating = p.rating != null ? `★ ${p.rating.toLocaleString("id-ID")}${p.reviews != null ? ` (${p.reviews.toLocaleString("id-ID")} ulasan)` : ""}` : "";
  const americano = p.americano ? `Americano ${fmtRp(p.americano.price)}` : "";
  const wifi = p.avgDown != null ? `WiFi ±${fmtMbps(p.avgDown, 0)} Mbps (${p.speedCount} tes)` : p.wifi.length ? `${p.wifi.length} WiFi tersimpan` : "";
  return { rating, americano, wifi };
}

export function placeDescription(p: PlaceView) {
  const f = placeFacts(p);
  const bits = [f.rating, f.americano, f.wifi, p.is24h ? "Buka 24 jam" : "", p.area].filter(Boolean);
  return `${bits.join(" · ")}. Cek kecepatan WiFi, password & harga di Nongki.`.replace(/^\. /, "");
}

export function placeShareText(p: PlaceView, url: string) {
  const f = placeFacts(p);
  const lines = [
    `☕ *${p.name}*`,
    [f.rating ? `⭐ ${f.rating.replace("★ ", "")}` : "", p.area ? `📍 ${p.area}` : ""].filter(Boolean).join(" · "),
    p.americano ? `💵 Americano ${fmtRp(p.americano.price)}${p.americano.note ? ` (${p.americano.note})` : ""}` : "",
    p.avgDown != null ? `📶 WiFi ±${fmtMbps(p.avgDown, 0)} Mbps · ping ${fmtMbps(p.avgPing, 0)} ms (${p.speedCount} tes)` : p.wifi.length ? `📶 ${p.wifi.length} WiFi tersimpan` : "",
    p.is24h ? "🌙 Buka 24 jam" : "",
    "",
    "Cek WiFi, password & harganya di Nongki:",
    url,
  ];
  return lines.filter((l, i) => l !== "" || i === 5).join("\n");
}
