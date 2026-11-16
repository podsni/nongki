import { listPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function GET() {
  const places = await listPlaces();
  return Response.json({ places: places.map(({ wifi, ...p }) => ({ ...p, wifiCount: wifi.length })) }, { headers: { "Cache-Control": "no-store" } });
}
