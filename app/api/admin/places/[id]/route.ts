import { errorJson, requireAdmin } from "@/lib/guard";
import { deletePlace, updatePlace } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const { id } = await ctx.params;
    const place = await updatePlace(id, (await req.json()) as Record<string, unknown>);
    return Response.json({ ok: true, place });
  } catch (e) {
    return errorJson(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const { id } = await ctx.params;
    await deletePlace(id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
