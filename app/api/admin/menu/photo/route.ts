import { requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Proxy foto galeri Google (admin saja) supaya OCR di browser tidak terhalang CORS. */
export async function GET(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  const u = new URL(req.url).searchParams.get("u") || "";
  if (!/^https:\/\/lh\d\.googleusercontent\.com\//.test(u)) return new Response("URL tidak diizinkan", { status: 400 });
  const r = await fetch(u.replace(/=[^/=]*$/, "") + "=w2000-h2000", { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return new Response("Gagal mengambil foto", { status: 502 });
  return new Response(r.body, { headers: { "Content-Type": r.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
