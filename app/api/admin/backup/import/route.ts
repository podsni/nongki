import { applyImport, CONFIRM_REPLACE, parseBackup, readJsonBody, type Mode } from "@/lib/backup";
import { errorJson, requireAdmin } from "@/lib/guard";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/** Body: { mode, confirm?, data }. Snapshot otomatis dibuat sebelum menulis. */
export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const body = (await readJsonBody(req)) as { mode?: string; confirm?: string; data?: unknown };
    const mode: Mode = body.mode === "replace" ? "replace" : "merge";
    if (mode === "replace" && String(body.confirm ?? "").trim().toUpperCase() !== CONFIRM_REPLACE)
      return errorJson(new Error(`Ketik ${CONFIRM_REPLACE} untuk mengonfirmasi penggantian semua data.`));
    const { db, warnings } = parseBackup(body.data);
    const { plan, snapshot } = await applyImport(db, mode, mode === "replace" ? "sebelum-ganti" : "sebelum-gabung");
    revalidatePath("/", "layout");
    return Response.json({ ok: true, plan, warnings, snapshot });
  } catch (e) {
    return errorJson(e);
  }
}
