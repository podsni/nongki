import type { Metadata } from "next";
import { SITE_DESC, SITE_NAME, SITE_TAGLINE, pageMeta } from "@/lib/site";
import { requestBase } from "@/lib/host";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Nav";
import { PlaceCard, PlaceRow, SectionHeader } from "@/components/ui";
import { NearbyHeroButton, NearbySection } from "@/components/Nearby";
import { listPlaces } from "@/lib/places";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { ...pageMeta({ base: await requestBase(), title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESC, path: "/", image: "/og/home.jpg", imageAlt: "Nongki — rekomendasi tempat ngopi lengkap dengan kecepatan WiFi" }), title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` } };
}

export default async function Home() {
  const places = await listPlaces();
  const fastest = [...places].filter((p) => p.avgDown != null).sort((a, b) => (b.avgDown ?? 0) - (a.avgDown ?? 0)).slice(0, 4);
  const open24 = places.filter((p) => p.is24h).slice(0, 4);

  return (
    <main>
      <section className="bg-espresso-900 text-cream-50">
        <div className="mx-auto grid [&>*]:min-w-0 max-w-6xl gap-8 px-4 pt-6 pb-8 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-16">
          <div className="space-y-5">
            <div className="md:hidden">
              <Logo light />
            </div>
            <h1 className="text-[28px] leading-tight font-extrabold tracking-tight md:text-5xl">
              Mau ngopi di mana hari ini?
              <span className="block text-caramel-500">Lengkap dengan kecepatan WiFi-nya.</span>
            </h1>
            <p className="max-w-xl text-sm text-cream-200 md:text-base">
              Rekomendasi tempat ngopi &amp; nongkrong, hasil cek internet dari pengunjung, plus daftar WiFi dan password-nya — tinggal salin.
            </p>
            <form action="/jelajah" className="flex max-w-xl gap-2">
              <label className="flex h-12 flex-1 items-center gap-2 rounded-[14px] bg-white px-4 text-ink-900">
                <Icon name="search" size={18} className="text-ink-500" />
                <input name="q" placeholder="Cari kafe, warkop, atau area…" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-500" aria-label="Cari tempat" />
              </label>
              <button className="grid size-12 place-items-center rounded-[14px] bg-caramel-500 text-white" aria-label="Cari">
                <Icon name="search" size={20} />
              </button>
            </form>
            <NearbyHeroButton />
            <div className="grid max-w-xl grid-cols-5 gap-2">
              {CATEGORIES.map((c) => (
                <Link key={c.key} href={`/jelajah?cat=${c.key}`} className="flex flex-col items-center gap-1.5 rounded-[14px] p-1 text-center hover:bg-white/5">
                  <span className="grid size-12 place-items-center rounded-[16px] bg-white/10 text-caramel-100 md:size-14">
                    <Icon name={c.icon} size={22} />
                  </span>
                  <span className="text-xs font-semibold">{c.label}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative h-full min-h-80 overflow-hidden rounded-[26px] bg-gradient-to-br from-espresso-600 to-espresso-900 p-6">
              <div className="absolute -top-10 -right-10 size-64 rounded-full bg-white/5" />
              <div className="absolute right-24 bottom-10 size-40 rounded-full bg-white/5" />
              <div className="relative space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-mint-100 px-3 py-1.5 text-sm font-semibold text-mint-600">
                  <Icon name="wifi" size={16} /> Cek kecepatan internet di tempat
                </span>
                <p className="max-w-xs text-2xl font-bold">Ukur download, upload, ping &amp; jitter langsung dari browser.</p>
                <Link href="/cek-speed" className="inline-flex items-center gap-2 rounded-[14px] bg-caramel-500 px-5 py-3 font-semibold text-white">
                  <Icon name="zap" size={18} /> Mulai cek
                </Link>
                <div className="flex gap-3 pt-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink-900">
                    <Icon name="star" size={14} fill="currentColor" className="text-star" /> Rating dari Google Maps
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-caramel-500 px-3 py-1.5 text-sm font-semibold text-white">
                    <Icon name="lock" size={14} /> Banyak WiFi per tempat
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6 md:py-10">
        <NearbySection places={places} />
        <section className="space-y-3">
          <SectionHeader title="Rekomendasi untukmu" href="/jelajah" />
          {places.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-line p-6 text-sm text-ink-500">Belum ada tempat. Admin bisa menambahkan dari link Google Maps.</p>
          ) : (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {places.slice(0, 8).map((p) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-2">
          <section className="space-y-3">
            <SectionHeader title="WiFi paling kencang" href="/jelajah?sort=wifi" />
            <div className="space-y-3">
              {fastest.length ? fastest.map((p) => <PlaceRow key={p.id} place={p} />) : (
                <Link href="/cek-speed" className="flex items-center gap-3 rounded-[18px] border border-dashed border-line bg-white p-4 text-sm text-ink-500 hover:border-mint-600">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-mint-100 text-mint-600">
                    <Icon name="zap" size={18} />
                  </span>
                  <span>
                    <b className="block text-ink-900">Belum ada hasil speed test</b>Lagi di salah satu tempat? Jadilah yang pertama mengukur WiFi-nya.
                  </span>
                </Link>
              )}
            </div>
          </section>
          <section className="space-y-3">
            <SectionHeader title="Buka 24 jam" href="/jelajah?cat=24jam" />
            <div className="space-y-3">
              {open24.length ? open24.map((p) => <PlaceRow key={p.id} place={p} />) : <p className="rounded-[18px] border border-dashed border-line p-4 text-sm text-ink-500">Belum ada tempat 24 jam.</p>}
            </div>
          </section>
        </div>

        <section className="flex flex-col items-start gap-4 rounded-[26px] bg-gradient-to-br from-espresso-600 to-espresso-900 p-5 text-cream-50 md:flex-row md:items-center md:p-8">
          <div className="flex-1 space-y-1">
            <h2 className="text-lg font-bold md:text-xl">Lagi di kafe? Cek internetnya sekarang</h2>
            <p className="text-sm text-cream-200">Hasilnya bisa disimpan ke tempat itu supaya pengunjung lain tahu WiFi-nya kencang atau tidak.</p>
          </div>
          <Link href="/cek-speed" className="inline-flex items-center gap-2 rounded-[14px] bg-mint-600 px-5 py-3 text-sm font-semibold text-white">
            <Icon name="zap" size={18} /> Cek kecepatan internet
          </Link>
        </section>
      </div>
    </main>
  );
}
