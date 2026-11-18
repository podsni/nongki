"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { PlaceView } from "@/lib/types";
import { haversineKm } from "@/lib/util";
import { fmtKm, forgetLocation, locate, useGeo, type Loc } from "./geo";
import { Icon } from "./Icon";
import { PlaceRow, SectionHeader } from "./ui";
import { DistanceText } from "./Distance";

export function byDistance(places: PlaceView[], loc: Loc | null) {
  return places
    .map((p) => ({ p, km: loc && p.lat != null && p.lng != null ? haversineKm(loc, { lat: p.lat, lng: p.lng }) : Infinity }))
    .filter((x) => isFinite(x.km))
    .sort((a, b) => a.km - b.km);
}

/** Tombol ikon "lokasi saya" (bar atas HP & di dalam kolom cari). */
export function NearbyIconButton({ className = "", inSearch = false }: { className?: string; inSearch?: boolean }) {
  const g = useGeo();
  const asking = g.status === "asking";
  return (
    <button
      type="button"
      aria-label={g.loc ? "Lihat tempat terdekat" : "Cari terdekat dari lokasiku"}
      title="Cari terdekat"
      onClick={async () => {
        document.getElementById("terdekat")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (!g.loc) await locate();
      }}
      className={`relative grid shrink-0 place-items-center rounded-full ${inSearch ? "size-11 rounded-[12px]" : "size-11"} ${className}`}
    >
      <Icon name={asking ? "loader" : "locate"} size={20} className={asking ? "animate-spin" : ""} />
      {g.loc && <span className="absolute top-2 right-2 size-2 rounded-full bg-mint-600 ring-2 ring-white" aria-hidden />}
    </button>
  );
}

/** Tombol di hero beranda: minta lokasi lalu gulir ke bagian "Terdekat dari kamu". */
export function NearbyHeroButton() {
  const g = useGeo();
  return (
    <button
      onClick={async () => {
        document.getElementById("terdekat")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (!g.loc) await locate();
      }}
      className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-white/20 bg-white/10 px-4 text-sm font-semibold text-cream-50 hover:bg-white/15"
    >
      <Icon name={g.status === "asking" ? "loader" : "locate"} size={18} className={g.status === "asking" ? "animate-spin" : ""} />
      {g.loc ? "Lihat yang terdekat" : "Cari terdekat dari lokasiku"}
    </button>
  );
}

export function NearbySection({ places }: { places: PlaceView[] }) {
  const g = useGeo();
  const near = useMemo(() => byDistance(places, g.loc).slice(0, 4), [places, g.loc]);
  const withCoords = places.filter((p) => p.lat != null && p.lng != null).length;
  const asking = g.status === "asking";

  return (
    <section id="terdekat" className="scroll-mt-20 space-y-3" data-testid="nearby">
      <SectionHeader title="Terdekat dari kamu" href={g.loc ? "/jelajah?sort=jarak" : undefined} />
      {!g.loc ? (
        <div className="flex items-center gap-3 rounded-[18px] border border-line bg-white p-3 md:p-4">
          <span className="hidden size-11 shrink-0 place-items-center rounded-[14px] bg-caramel-100 text-espresso-600 sm:grid">
            <Icon name="locate" size={20} />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <b className="block text-ink-900">Tempat ngopi di dekatmu</b>
            <span className="text-xs text-ink-500 md:text-sm">Lokasi tidak disimpan di server.</span>
            {g.msg && !asking && <span className="mt-1 block font-medium text-amber-500" role="alert">{g.msg}</span>}
          </div>
          <button onClick={() => locate()} disabled={asking} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-espresso-600 px-4 text-sm font-semibold text-white disabled:opacity-70">
            <Icon name={asking ? "loader" : "locate"} size={18} className={asking ? "animate-spin" : ""} />
            {asking ? "Mencari…" : g.msg ? "Coba lagi" : "Cari terdekat"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 [&>*]:min-w-0 lg:grid-cols-2">
            {near.map(({ p, km }) => (
              <PlaceRow key={p.id} place={p} extra={<DistanceText km={km} />} />
            ))}
          </div>
          {near.length === 0 && <p className="rounded-[18px] border border-dashed border-line p-4 text-sm text-ink-500">Belum ada tempat dengan koordinat untuk dihitung jaraknya.</p>}
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink-500 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>button]:min-h-11">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-caramel-500" /> Lokasimu{g.loc.acc ? ` (akurasi ±${g.loc.acc.toLocaleString("id-ID")} m)` : ""}
            </span>
            {withCoords < places.length && <span>{places.length - withCoords} tempat tanpa koordinat tidak dihitung</span>}
            <button onClick={() => locate()} className="font-semibold text-espresso-600 hover:underline">
              Perbarui lokasi
            </button>
            <button onClick={forgetLocation} className="font-semibold text-ink-500 hover:underline">
              Lupakan
            </button>
            <Link href="/jelajah?sort=jarak&view=peta" className="font-semibold text-espresso-600 hover:underline">
              Lihat di peta →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

/** Chip jarak di halaman detail (hanya tampil bila lokasi sudah diketahui, atau tombol untuk menghitung). */
export function DistanceChip({ lat, lng }: { lat: number | null; lng: number | null }) {
  const g = useGeo();
  if (lat == null || lng == null) return null;
  if (!g.loc)
    return (
      <button onClick={() => locate()} className="inline-flex items-center gap-1 text-sm font-semibold text-espresso-600 hover:underline">
        <Icon name={g.status === "asking" ? "loader" : "locate"} size={14} className={g.status === "asking" ? "animate-spin" : ""} /> {g.status === "asking" ? "Menghitung…" : "Jarak dari saya"}
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-espresso-600" data-testid="distance">
      • <Icon name="nav" size={13} /> {fmtKm(haversineKm(g.loc, { lat, lng }))} dari kamu
    </span>
  );
}

