import type { Metadata } from "next";
import { SpeedTest } from "@/components/SpeedTest";
import { listPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cek kecepatan internet" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tempat = typeof sp.tempat === "string" ? sp.tempat : "";
  const places = (await listPlaces()).map((p) => ({ id: p.id, slug: p.slug, name: p.name, area: p.area, wifi: p.wifi.map((w) => ({ id: w.id, ssid: w.ssid })) }));
  return <SpeedTest places={places} initialSlug={tempat} />;
}
