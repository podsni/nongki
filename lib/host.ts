import "server-only";
import { headers } from "next/headers";
import { baseUrlFor } from "./site";

/** Base URL sesuai domain yang sedang dibuka (nongki-malang.vercel.app / nongki.bangundwir.my.id / …). */
export async function requestBase(): Promise<string> {
  const h = await headers();
  return baseUrlFor(h.get("x-forwarded-host") || h.get("host"), h.get("x-forwarded-proto"));
}

/** Sama, untuk route handler (gambar OG/story). */
export function baseFromRequest(req: Request): string {
  return baseUrlFor(req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host, req.headers.get("x-forwarded-proto"));
}
