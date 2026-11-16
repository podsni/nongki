import { errorJson, requireAdmin } from "@/lib/guard";
import { importFromGoogleMaps } from "@/lib/maps";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) throw new Error("Tempel link Google Maps dulu");
    const draft = await importFromGoogleMaps(url);
    return Response.json({ ok: true, draft });
  } catch (e) {
    return errorJson(e);
  }
}
