import { deleteSnapshot, readSnapshot, validSnapshotName } from "@/lib/backup";
import { errorJson, requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

/** Unduh snapshot lewat route admin (Blob tetap private). */
export async function GET(_req: Request, { params }: Ctx) {
  const deny = await requireAdmin();
  if (deny) return deny;
  const { name } = await params;
  if (!validSnapshotName(name)) return errorJson(new Error("Nama backup tidak valid."), 404);
  try {
    const text = await readSnapshot(name);
    return new Response(text, {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="nongki-${name}"`, "Cache-Control": "no-store, private" },
    });
  } catch (e) {
    return errorJson(e, 404);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    await deleteSnapshot((await params).name);
    return Response.json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
