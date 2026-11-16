import { errorJson, requireAdmin } from "@/lib/guard";
import { addSpeed } from "@/lib/places";

export const dynamic = "force-dynamic";

// Simpan hasil tes yang dijalankan admin langsung di tempat.
export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const r = await addSpeed((await req.json()) as Record<string, unknown>, "admin");
    return Response.json({ ok: true, result: r });
  } catch (e) {
    return errorJson(e);
  }
}
