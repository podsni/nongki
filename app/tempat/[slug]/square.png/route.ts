import { getPlace } from "@/lib/places";
import { baseFromRequest } from "@/lib/host";
import { placeSquare } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const r = await getPlace((await params).slug);
  if (!r) return new Response("Not found", { status: 404 });
  const res = await placeSquare(r.place, r.speeds, baseFromRequest(req));
  if (new URL(req.url).searchParams.has("download")) res.headers.set("content-disposition", `attachment; filename="nongki-${r.place.slug}-square.png"`);
  return res;
}
