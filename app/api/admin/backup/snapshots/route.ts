import { createSnapshot, listSnapshots } from "@/lib/backup";
import { storageMode } from "@/lib/db";
import { errorJson, requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    return Response.json({ ok: true, storage: storageMode(), snapshots: await listSnapshots() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorJson(e, 500);
  }
}

/** Buat backup manual sekarang. */
export async function POST() {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    return Response.json({ ok: true, snapshot: await createSnapshot("manual") });
  } catch (e) {
    return errorJson(e, 500);
  }
}
