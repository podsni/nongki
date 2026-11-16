import type { MenuPrice, Place, PlaceView, SpeedLevel, SpeedResult } from "./types";

export function uid(prefix = ""): string {
  const a = crypto.getRandomValues(new Uint8Array(9));
  return prefix + Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tempat"
  );
}

export function levelOf(mbps: number | null | undefined): SpeedLevel | null {
  if (mbps == null || !isFinite(mbps)) return null;
  if (mbps >= 30) return "Cepat";
  if (mbps >= 10) return "Sedang";
  return "Lambat";
}

export function fmtMbps(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: n >= 100 ? 0 : digits, minimumFractionDigits: 0 });
}

export function toView(p: Place, speeds: SpeedResult[]): PlaceView {
  const mine = speeds.filter((s) => s.placeId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const last = mine.slice(0, 5);
  const avg = (k: "down" | "up" | "ping") => (last.length ? last.reduce((a, s) => a + s[k], 0) / last.length : null);
  const avgDown = avg("down");
  return { ...p, avgDown, avgUp: avg("up"), avgPing: avg("ping"), speedCount: mine.length, level: levelOf(avgDown), americano: americanoOf(p) };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function mapsRouteUrl(p: Pick<Place, "lat" | "lng" | "name" | "address">): string {
  if (p.lat != null && p.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.name + ", " + p.address)}`;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

/** Ubah ukuran URL foto Google (lh*.googleusercontent.com/...=w..-h..) agar hemat kuota. */
export function photoSize(url: string, w: number, h: number) {
  if (!/googleusercontent\.com\//.test(url)) return url;
  const base = url.replace(/=[^/]*$/, "");
  return `${base}=w${w}-h${h}-k-no`;
}

/** Status buka sekarang (zona Asia/Jakarta) dari baris jam buka Google, mis. "15.00–23.00". */
export function openStatus(p: { is24h: boolean; hours: { day: string; text: string }[] }, now = new Date()): { open: boolean; label: string } | null {
  if (p.is24h) return { open: true, label: "Buka 24 jam" };
  if (!p.hours.length) return null;
  const fmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const day = String(parts.weekday).toLowerCase();
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const days = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
  const rowOf = (d: string) => p.hours.find((h) => h.day.toLowerCase() === d);
  const ranges = (t: string) =>
    [...t.matchAll(/(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})/g)].map((m) => [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] as const);
  const today = rowOf(day);
  if (!today) return null;
  if (/24 jam/i.test(today.text)) return { open: true, label: "Buka 24 jam hari ini" };
  for (const [a, b] of ranges(today.text)) {
    const end = b <= a ? b + 1440 : b;
    if (mins >= a && mins < end) return { open: true, label: `Buka · tutup ${String(Math.floor((b % 1440) / 60)).padStart(2, "0")}.${String(b % 60).padStart(2, "0")}` };
  }
  // shift malam kemarin yang lewat tengah malam
  const yest = rowOf(days[(days.indexOf(day) + 6) % 7]);
  for (const [a, b] of yest ? ranges(yest.text) : []) if (b <= a && mins < b) return { open: true, label: "Buka sekarang" };
  const next = ranges(today.text).find(([a]) => a > mins);
  if (next) return { open: false, label: `Tutup · buka ${String(Math.floor(next[0] / 60)).padStart(2, "0")}.${String(next[0] % 60).padStart(2, "0")}` };
  return { open: false, label: /tutup/i.test(today.text) ? "Tutup hari ini" : "Tutup sekarang" };
}

export function americanoOf(p: Pick<Place, "menu">): MenuPrice | null {
  return (p.menu || []).find((m) => /americano/i.test(m.item)) ?? null;
}

/** Rp 18.000 → "Rp18.000"; ringkas: "Rp18rb". */
export function fmtRp(n: number | null | undefined, short = false): string {
  if (n == null || !isFinite(n)) return "—";
  if (short && n >= 1000 && n % 1000 === 0) return `Rp${n / 1000}rb`;
  if (short && n >= 1000) return `Rp${(n / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
  return "Rp" + n.toLocaleString("id-ID");
}

/** "2026-11-16" → "16 Nov 2026" */
export function fmtDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(d + "T12:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}
