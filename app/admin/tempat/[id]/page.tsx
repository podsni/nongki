import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { MenuFromPhoto } from "@/components/admin/MenuFromPhoto";
import { DeleteButton, DeleteSpeedButton, PlaceForm } from "@/components/admin/PlaceForm";
import { toForm } from "@/lib/form";
import { SpeedTest } from "@/components/SpeedTest";
import { WifiBadge } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { getPlace } from "@/lib/places";
import { fmtMbps, levelOf, timeAgo } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isAdmin())) return <LoginForm />;
  const { id } = await params;
  const sp = await searchParams;
  const data = await getPlace(id);
  if (!data) notFound();
  const { place, speeds } = data;
  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin" className="text-sm font-semibold text-ink-500">← Kembali</Link>
        <div className="flex items-center gap-2">
          <a href="#menu-foto" className="rounded-[10px] border border-line px-3 py-1.5 text-xs font-semibold">Menu dari foto</a>
          <a href="#speedtest" className="rounded-[10px] bg-mint-600 px-3 py-1.5 text-xs font-semibold text-white">Tes kecepatan</a>
          <Link href={`/tempat/${place.slug}`} className="rounded-[10px] border border-line px-3 py-1.5 text-xs font-semibold">Lihat halaman</Link>
          <DeleteButton id={place.id} name={place.name} redirect="/admin" />
        </div>
      </div>
      {sp.baru && <p className="rounded-[14px] bg-mint-100 px-4 py-3 text-sm font-semibold text-mint-600">Tempat berhasil ditambahkan. Kamu bisa lanjut mengedit di sini.</p>}
      <h1 className="text-2xl font-extrabold">Edit: {place.name}</h1>
      <PlaceForm initial={toForm(place as unknown as Record<string, unknown>)} placeId={place.id} />
      <MenuFromPhoto placeId={place.id} photos={place.photos} menu={place.menu} />
      <section id="speedtest" className="scroll-mt-20">
        <SpeedTest admin initialSlug={place.slug} places={[{ id: place.id, slug: place.slug, name: place.name, area: place.area, wifi: place.wifi.map((w) => ({ id: w.id, ssid: w.ssid })) }]} />
      </section>
      <section className="mb-28 space-y-3 rounded-[18px] border border-line bg-white p-4 md:p-5">
        <h2 className="font-bold">Riwayat tes kecepatan ({speeds.length})</h2>
        {speeds.length === 0 && <p className="text-sm text-ink-500">Belum ada tes.</p>}
        {speeds.map((s) => (
          <div key={s.id} className="flex items-center gap-3 border-t border-line pt-2 text-sm first-of-type:border-0">
            <WifiBadge level={levelOf(s.down)} mbps={s.down} />
            {s.by === "admin" && <span className="rounded-full bg-espresso-600/10 px-2 py-0.5 text-[11px] font-semibold text-espresso-600">Admin</span>}
            <span className="min-w-0 truncate text-ink-500">↑ {fmtMbps(s.up)} · {fmtMbps(s.ping)} ms{s.loss != null ? ` · loss ${fmtMbps(s.loss)}%` : ""} · {place.wifi.find((w) => w.id === s.wifiId)?.ssid ?? "—"} · {timeAgo(s.createdAt)}</span>
            <span className="ml-auto"><DeleteSpeedButton id={s.id} /></span>
          </div>
        ))}
      </section>
    </main>
  );
}
