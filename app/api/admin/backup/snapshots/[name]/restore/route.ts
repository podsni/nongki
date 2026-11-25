import { applyImport, CONFIRM_RESTORE, parseBackup, readSnapshot, validSnapshotName } from "@/lib/backup";
import { errorJson, requireAdmin } from "@/lib/guard";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/** Pulihkan snapshot (mode ganti semua). Body: { confirm }. Snapshot otomatis dibuat dulu. */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;
  const { name } = await params;
  if (!validSnapshotName(name)) return errorJson(new Error("Nama backup tidak valid."), 404);
  try {
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (String(body.confirm ?? "").trim().toUpperCase() !== CONFIRM_RESTORE) return errorJson(new Error(`Ketik ${CONFIRM_RESTORE} untuk mengonfirmasi pemulihan.`));
    let raw: unknown;
    try {
      raw = JSON.parse(await readSnapshot(name));
    } catch (e) {
      throw e instanceof SyntaxError ? new Error("File backup rusak (bukan JSON valid).") : e;
    }
    const { db, warnings } = parseBackup(raw);
    const { plan, snapshot } = await applyImport(db, "replace", "sebelum-pulihkan");
    revalidatePath("/", "layout");
    return Response.json({ ok: true, plan, warnings, snapshot });
  } catch (e) {
    return errorJson(e);
  }
}
