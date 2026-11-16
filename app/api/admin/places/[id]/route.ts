import { errorJson, requireAdmin } from "@/lib/guard";
import { deletePlace, getPlace, updatePlace } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;
  const r = await getPlace((await ctx.params).id);
  if (!r) return Response.json({ ok: false, error: "Tempat tidak ditemukan" }, { status: 404 });
  return Response.json({ ok: true, place: r.place, speeds: r.speeds });
}

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
