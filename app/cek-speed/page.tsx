import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { requestBase } from "@/lib/host";
import { SpeedTest } from "@/components/SpeedTest";
import { listPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ base: await requestBase(), title: "Cek kecepatan internet", description: "Ukur download, upload, ping, jitter & packet loss WiFi tempat ngopi langsung dari browser, lalu simpan hasilnya ke tempat itu.", path: "/cek-speed", image: "/og/home.jpg", imageAlt: "Cek kecepatan internet di Nongki" });
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tempat = typeof sp.tempat === "string" ? sp.tempat : "";
  const places = (await listPlaces()).map((p) => ({ id: p.id, slug: p.slug, name: p.name, area: p.area, wifi: p.wifi.map((w) => ({ id: w.id, ssid: w.ssid })) }));
  return <SpeedTest places={places} initialSlug={tempat} />;
}
