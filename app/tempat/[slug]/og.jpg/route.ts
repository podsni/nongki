import { getPlace } from "@/lib/places";
import { baseFromRequest } from "@/lib/host";
import { placeOg } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const r = await getPlace((await params).slug);
  if (!r) return new Response("Not found", { status: 404 });
  return placeOg(r.place, baseFromRequest(req), r.speeds);
}
