import type { Metadata } from "next";
import { Explorer } from "@/components/Explorer";
import { listPlaces } from "@/lib/places";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta({ title: "Jelajah tempat ngopi & nongkrong", description: "Cari tempat ngopi di Malang: filter WiFi kencang, colokan, buka 24 jam, Americano termurah, atau yang terdekat dari lokasimu.", path: "/jelajah", image: "/og/jelajah.jpg", imageAlt: "Jelajah tempat ngopi & nongkrong di Nongki" });

export default async function Jelajah({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const places = await listPlaces();
  return <Explorer places={places} initial={{ q: one("q") ?? "", cat: one("cat") ?? "", sort: one("sort") ?? "rating", view: one("view") === "peta" ? "peta" : "list" }} />;
}
