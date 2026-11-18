import type { Metadata } from "next";
import { SITE_DESC, SITE_NAME, SITE_TAGLINE, pageMeta } from "@/lib/site";
import { requestBase } from "@/lib/host";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Nav";
import { PlaceCard, PlaceRow, SectionHeader } from "@/components/ui";
import { NearbyHeroButton, NearbyIconButton, NearbySection } from "@/components/Nearby";
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
      {/* Bar atas ringkas (HP) — sticky */}
      <header className="sticky top-0 z-40 bg-espresso-900/95 pt-[env(safe-area-inset-top)] text-cream-50 backdrop-blur md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <Logo light compact />
          <div className="ml-auto flex items-center gap-1">
            <NearbyIconButton className="text-cream-50 hover:bg-white/10" />
            <Link href="/cek-speed" aria-label="Cek kecepatan internet" className="grid size-11 place-items-center rounded-full text-mint-100 hover:bg-white/10">
              <Icon name="zap" size={20} />
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-espresso-900 text-cream-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-1 pb-4 [&>*]:min-w-0 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-10 md:px-6 md:py-10">
          <div className="space-y-3 md:space-y-5">
            <div className="space-y-1 md:space-y-3">
              <h1 className="text-[22px] leading-tight font-extrabold tracking-tight md:text-[40px] md:leading-[1.1]">Mau ngopi di mana hari ini?</h1>
              <p className="text-sm text-caramel-100 md:text-lg">
                <span className="font-semibold text-caramel-500">Lengkap dengan kecepatan WiFi-nya.</span>
                <span className="hidden md:inline"> Hasil cek internet dari pengunjung, daftar WiFi &amp; password — tinggal salin.</span>
              </p>
            </div>
            <form action="/jelajah" className="flex max-w-xl gap-2" role="search">
              <label className="flex h-12 flex-1 items-center gap-2 rounded-[14px] bg-white pr-0.5 pl-4 text-ink-900 shadow-sm focus-within:ring-2 focus-within:ring-caramel-500">
                <Icon name="search" size={18} className="shrink-0 text-ink-500" />
                <input name="q" type="search" enterKeyHint="search" placeholder="Cari kafe, warkop, atau area…" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-500 md:text-sm" aria-label="Cari tempat" />
                <NearbyIconButton inSearch className="text-espresso-600 hover:bg-cream-100" />
              </label>
              <button className="hidden h-12 items-center gap-2 rounded-[14px] bg-caramel-500 px-5 text-sm font-semibold text-white hover:opacity-95 md:inline-flex">
                <Icon name="search" size={18} /> Cari
              </button>
            </form>
            <nav aria-label="Kategori" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
              {CATEGORIES.map((c) => (
                <Link key={c.key} href={`/jelajah?cat=${c.key}`} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-cream-50 hover:bg-white/15">
                  <Icon name={c.icon} size={16} className="text-caramel-100" /> {c.label}
                </Link>
              ))}
              <Link href="/jelajah?sort=americano" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-cream-50 hover:bg-white/15">
                <Icon name="coffee" size={16} className="text-caramel-100" /> Americano murah
              </Link>
            </nav>
          </div>
          <div className="hidden md:block">
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-espresso-600 to-espresso-900 p-6">
              <div className="absolute -top-10 -right-10 size-48 rounded-full bg-white/5" />
              <div className="relative space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-mint-100 px-3 py-1.5 text-sm font-semibold text-mint-600">
                  <Icon name="wifi" size={16} /> Cek internet di tempat
                </span>
                <p className="max-w-xs text-xl font-bold">Ukur download, upload, ping &amp; jitter langsung dari browser.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/cek-speed" className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-caramel-500 px-5 font-semibold text-white">
                    <Icon name="zap" size={18} /> Mulai cek
                  </Link>
                  <NearbyHeroButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-7 px-4 pt-4 pb-6 md:space-y-10 md:px-6 md:py-10">
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
