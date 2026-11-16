import { errorJson, requireAdmin } from "@/lib/guard";
import { createPlace } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const place = await createPlace((await req.json()) as Record<string, unknown>);
    return Response.json({ ok: true, place });
  } catch (e) {
    return errorJson(e);
  }
}
