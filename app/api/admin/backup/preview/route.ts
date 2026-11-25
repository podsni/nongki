import { parseBackup, planImport, readJsonBody, type Mode } from "@/lib/backup";
import { loadDB } from "@/lib/db";
import { errorJson, requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Body: { mode, data } — data = isi file backup. Tidak menulis apa pun. */
export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const body = (await readJsonBody(req)) as { mode?: string; data?: unknown };
    const mode: Mode = body.mode === "replace" ? "replace" : "merge";
    const { db, warnings, meta } = parseBackup(body.data);
    const { plan } = planImport(await loadDB(), db, mode);
    return Response.json({ ok: true, plan, warnings, meta });
  } catch (e) {
    return errorJson(e);
  }
}
