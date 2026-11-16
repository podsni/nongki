import "server-only";
import { headers } from "next/headers";
import { ALLOWED_HOSTS, baseUrlFor, hostOf } from "./site";

/** Base URL sesuai domain yang sedang dibuka (nongki-malang.vercel.app / nongki.bangundwir.my.id / …). */
export async function requestBase(): Promise<string> {
  const h = await headers();
  return baseUrlFor(h.get("x-forwarded-host") || h.get("host"), h.get("x-forwarded-proto"));
}

/** Untuk route handler gambar OG/story: pakai ?h=<domain> (bila ada di allowlist), jika tidak → host request. */
export function baseFromRequest(req: Request): string {
  const h = new URL(req.url).searchParams.get("h");
  if (h && ALLOWED_HOSTS.has(h.toLowerCase())) return `https://${h.toLowerCase()}`;
  return baseUrlFor(req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host, req.headers.get("x-forwarded-proto"));
}

/** Query untuk URL gambar: versi data + domain (kunci cache per domain). */
export const imgQuery = (v: string, base: string) => `v=${v}&h=${encodeURIComponent(hostOf(base))}`;
