import { errorJson, requireAdmin } from "@/lib/guard";
import { deleteSpeed } from "@/lib/places";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    await deleteSpeed((await ctx.params).id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
