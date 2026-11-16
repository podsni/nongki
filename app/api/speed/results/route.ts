import { addSpeed } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const r = await addSpeed(body);
    return Response.json({ ok: true, result: r });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan" }, { status: 400 });
  }
}
