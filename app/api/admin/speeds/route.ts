import { errorJson, requireAdmin } from "@/lib/guard";
import { addSpeedsFromBody } from "@/lib/places";

export const dynamic = "force-dynamic";

// Simpan hasil tes yang dijalankan admin langsung di tempat.
export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const results = await addSpeedsFromBody((await req.json()) as Record<string, unknown>, "admin");
    return Response.json({ ok: true, results, result: results[0] });
  } catch (e) {
    return errorJson(e);
  }
}
