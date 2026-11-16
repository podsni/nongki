import { isAdmin } from "@/lib/auth";
import { addSpeedsFromBody } from "@/lib/places";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Simpan hasil tes dari pengunjung (publik, dibatasi 6 hasil / 10 menit / IP).
export async function POST(req: Request) {
  try {
    const admin = await isAdmin();
    if (!admin && !allow("speed:" + clientIp(req), 6, 10 * 60_000)) {
      return Response.json({ ok: false, error: "Terlalu banyak hasil disimpan. Coba lagi beberapa menit lagi." }, { status: 429 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    // pengunjung hanya boleh 1 hasil per kiriman; admin boleh satu sesi (maks. 10)
    if (!admin && Array.isArray(body.results) && body.results.length > 1) throw new Error("Pengunjung hanya bisa menyimpan 1 hasil per kiriman");
    const results = await addSpeedsFromBody(body, admin ? "admin" : "pengunjung");
    return Response.json({ ok: true, results, result: results[0] });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan" }, { status: 400 });
  }
}
