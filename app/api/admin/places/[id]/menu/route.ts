import { errorJson, requireAdmin } from "@/lib/guard";
import { saveMenuItems } from "@/lib/places";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/** Body: { items: MenuPrice[], mode?: "merge" | "replace", update?: boolean, confirm?: "GANTI" } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const body = (await req.json()) as { items?: unknown; mode?: string; update?: boolean; confirm?: string };
    const mode = body.mode === "replace" ? "replace" : "merge";
    if (mode === "replace" && String(body.confirm ?? "").trim().toUpperCase() !== "GANTI") throw new Error("Ketik GANTI untuk mengganti seluruh menu.");
    const r = await saveMenuItems((await params).id, body.items, mode, !!body.update);
    revalidatePath("/", "layout");
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return errorJson(e);
  }
}
