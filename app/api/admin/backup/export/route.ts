import { backupFileName, placesCsv, toBackup } from "@/lib/backup";
import { loadDB } from "@/lib/db";
import { errorJson, requireAdmin } from "@/lib/guard";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" };

export async function GET(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const db = await loadDB();
    const format = new URL(req.url).searchParams.get("format");
    if (format === "csv") {
      const name = backupFileName().replace("nongki-backup", "nongki-tempat").replace(/\.json$/, ".csv");
      return new Response(placesCsv(db), { headers: { ...NO_STORE, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
    }
    return new Response(JSON.stringify(toBackup(db), null, 2), {
      headers: { ...NO_STORE, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${backupFileName()}"` },
    });
  } catch (e) {
    return errorJson(e, 500);
  }
}
