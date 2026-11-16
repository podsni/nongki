import type { Place, PlaceView, SpeedLevel, SpeedResult } from "./types";

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
  return { ...p, avgDown, avgUp: avg("up"), avgPing: avg("ping"), speedCount: mine.length, level: levelOf(avgDown) };
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
