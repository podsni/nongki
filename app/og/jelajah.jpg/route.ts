import { listPlaces } from "@/lib/places";
import { siteOg } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return siteOg(await listPlaces(), "jelajah");
}
