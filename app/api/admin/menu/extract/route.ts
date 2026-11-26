import { errorJson, requireAdmin } from "@/lib/guard";
import { aiAvailable, extractMenuAI } from "@/lib/menuai";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGES = 6;
const MAX_BODY = 4 * 1024 * 1024;
const PHOTO_HOST = /^https:\/\/lh\d\.googleusercontent\.com\//;

/** Body: { images?: string[] (data URL JPEG/PNG/WebP), urls?: string[] (foto galeri Google) } */
export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  if (!aiAvailable()) return Response.json({ ok: false, code: "no-ai", error: "Pembaca menu AI belum aktif di server ini. Gunakan mode OCR di browser." }, { status: 503 });
  if (!allow("menu:" + clientIp(req), 20, 10 * 60_000)) return errorJson(new Error("Terlalu sering. Coba lagi beberapa menit lagi (maks. 20× / 10 menit)."), 429);
  try {
    if (Number(req.headers.get("content-length") || 0) > MAX_BODY) throw new Error("Foto terlalu besar. Maks. total 4 MB (foto otomatis dikecilkan di browser).");
    const body = (await req.json()) as { images?: unknown; urls?: unknown };
    const dataUrls = (Array.isArray(body.images) ? body.images : []).filter((x): x is string => typeof x === "string");
    const urls = (Array.isArray(body.urls) ? body.urls : []).filter((x): x is string => typeof x === "string" && PHOTO_HOST.test(x));
    if (!dataUrls.length && !urls.length) throw new Error("Pilih minimal satu foto menu.");
    if (dataUrls.length + urls.length > MAX_IMAGES) throw new Error(`Maksimal ${MAX_IMAGES} foto sekali baca.`);
    const sharp = (await import("sharp")).default;
    const prep = async (buf: Buffer) => ({ data: new Uint8Array(await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()), mediaType: "image/jpeg" });
    const images = [];
    for (const d of dataUrls) {
      const m = d.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
      if (!m) throw new Error("Format foto tidak didukung (pakai JPG/PNG/WebP).");
      images.push(await prep(Buffer.from(m[2], "base64")));
    }
    for (const u of urls) {
      const r = await fetch(u.replace(/=[^/=]*$/, "") + "=w2000-h2000", { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("Gagal mengambil foto dari Google Maps.");
      images.push(await prep(Buffer.from(await r.arrayBuffer())));
    }
    const res = await extractMenuAI(images);
    return Response.json({ ok: true, engine: "ai", ...res });
  } catch (e) {
    console.error("menu extract", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/credit|billing|unauthor|authentication|oidc|api key|402|403/i.test(msg)) return Response.json({ ok: false, code: "no-ai", error: "AI Gateway menolak permintaan (kredit/izin). Gunakan mode OCR di browser, atau aktifkan AI Gateway di Vercel." }, { status: 503 });
    return errorJson(e);
  }
}
