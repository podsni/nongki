"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { PlaceView } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { haversineKm } from "@/lib/util";
import { Icon } from "./Icon";
import { PlaceRow } from "./ui";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-ink-500">Memuat peta…</div> });

type Sort = "rating" | "wifi" | "24jam" | "harga" | "jarak";
const SORTS: { key: Sort; label: string }[] = [
  { key: "rating", label: "Rating" },
  { key: "wifi", label: "Kecepatan internet" },
  { key: "24jam", label: "Buka 24 jam" },
  { key: "harga", label: "Harga termurah" },
  { key: "jarak", label: "Jarak" },
];

export function Explorer({ places, initial }: { places: PlaceView[]; initial: { q: string; cat: string; sort: string; view: "list" | "peta" } }) {
  const [q, setQ] = useState(initial.q);
  const [cats, setCats] = useState<string[]>(initial.cat ? [initial.cat] : []);
  const [fastOnly, setFastOnly] = useState(false);
  const [plugOnly, setPlugOnly] = useState(false);
  const [sort, setSort] = useState<Sort>((SORTS.find((s) => s.key === initial.sort)?.key ?? "rating") as Sort);
  const [view, setView] = useState<"list" | "peta">(initial.view);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    url.searchParams.delete("cat");
    url.searchParams.delete("sort");
    url.searchParams.delete("view");
    if (q) url.searchParams.set("q", q);
    if (cats.length === 1) url.searchParams.set("cat", cats[0]);
    if (sort !== "rating") url.searchParams.set("sort", sort);
    if (view === "peta") url.searchParams.set("view", "peta");
    window.history.replaceState(null, "", url.toString());
  }, [q, cats, sort, view]);

  function askLocation(then?: () => void) {
    if (!navigator.geolocation) return setGeoMsg("Browser tidak mendukung lokasi.");
    setGeoMsg("Mencari lokasimu…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoMsg("");
        then?.();
      },
      () => setGeoMsg("Izin lokasi ditolak — urutan jarak tidak bisa dipakai."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = places.filter((p) => {
      if (term && !`${p.name} ${p.address} ${p.area}`.toLowerCase().includes(term)) return false;
      if (cats.length && !cats.every((c) => (c === "24jam" ? p.is24h : c === "murah" ? p.priceLevel === 1 || p.categories.includes("murah") : p.categories.includes(c)))) return false;
      if (fastOnly && !((p.avgDown ?? 0) >= 30)) return false;
      if (plugOnly && !p.facilities.includes("colokan")) return false;
      return true;
    });
    const dist = (p: PlaceView) => (me && p.lat != null && p.lng != null ? haversineKm(me, { lat: p.lat, lng: p.lng }) : Infinity);
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "wifi":
          return (b.avgDown ?? -1) - (a.avgDown ?? -1);
        case "24jam":
          return Number(b.is24h) - Number(a.is24h) || (b.rating ?? 0) - (a.rating ?? 0);
        case "harga":
          return (a.priceLevel ?? 9) - (b.priceLevel ?? 9) || (b.rating ?? 0) - (a.rating ?? 0);
        case "jarak":
          return dist(a) - dist(b);
        default:
          return (b.rating ?? 0) - (a.rating ?? 0);
      }
    });
    return out.map((p) => ({ p, km: dist(p) }));
  }, [places, q, cats, fastOnly, plugOnly, sort, me]);

  const toggleCat = (k: string) => setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${on ? "border-espresso-600 bg-espresso-600 text-white" : "border-line bg-white text-ink-900 hover:border-caramel-500"}`;

  const filters = (
    <div className="space-y-4">
      <label className="flex h-12 items-center gap-2 rounded-[14px] border border-line bg-white px-4">
        <Icon name="search" size={18} className="text-ink-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari “kopi susu”, “warkop 24 jam”, area…" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-500" aria-label="Cari tempat" />
        {q && (
          <button onClick={() => setQ("")} aria-label="Hapus pencarian" className="text-ink-500">
            <Icon name="x" size={16} />
          </button>
        )}
      </label>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <button className={chip(!cats.length && !fastOnly && !plugOnly)} onClick={() => { setCats([]); setFastOnly(false); setPlugOnly(false); }}>
          Semua
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={chip(cats.includes(c.key))} onClick={() => toggleCat(c.key)}>
            {c.label}
          </button>
        ))}
        <button className={chip(fastOnly)} onClick={() => setFastOnly((v) => !v)}>
          WiFi ≥ 30 Mbps
        </button>
        <button className={chip(plugOnly)} onClick={() => setPlugOnly((v) => !v)}>
          Ada colokan
        </button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
          <Icon name="sort" size={15} /> Urutkan berdasarkan
          <span className="ml-auto font-normal">{list.length} tempat</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => (s.key === "jarak" && !me ? askLocation(() => setSort("jarak")) : setSort(s.key))}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${sort === s.key ? "border-espresso-600 bg-cream-100 text-espresso-600" : "border-line bg-white text-ink-900"}`}
            >
              {sort === s.key && <Icon name="check" size={13} strokeWidth={3} />}
              {s.label}
            </button>
          ))}
        </div>
        {geoMsg && <p className="text-xs text-amber-500">{geoMsg}</p>}
      </div>
    </div>
  );

  const toggle = (
    <div className="flex h-10 w-44 items-center gap-1 rounded-full bg-cream-100 p-1" role="tablist" aria-label="Tampilan">
      {(["list", "peta"] as const).map((v) => (
        <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold ${view === v ? "bg-espresso-600 text-white" : "text-espresso-600"}`}>
          <Icon name={v === "list" ? "list" : "map"} size={15} /> {v === "list" ? "List" : "Peta"}
        </button>
      ))}
    </div>
  );

  const rows = (
    <div className="space-y-3">
      {list.length === 0 && <p className="rounded-[18px] border border-dashed border-line p-6 text-center text-sm text-ink-500">Tidak ada tempat yang cocok. Coba hapus filter.</p>}
      {list.map(({ p, km }) => (
        <div key={p.id} onMouseEnter={() => setSelected(p.id)} className={selected === p.id && view === "peta" ? "rounded-[20px] ring-2 ring-caramel-500" : ""}>
          <PlaceRow place={p} extra={isFinite(km) ? <span className="shrink-0">• {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`}</span> : null} />
        </div>
      ))}
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">Jelajah</h1>
        {toggle}
      </div>
      <div className="grid gap-6 [&>*]:min-w-0 md:grid-cols-[340px_1fr] lg:grid-cols-[380px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">{filters}</aside>
        <section>
          {view === "list" ? (
            rows
          ) : (
            <div className="space-y-4">
              <div className="relative h-[60dvh] min-h-80 overflow-hidden rounded-[18px] border border-line md:h-[560px]">
                <MapView places={list.map((x) => x.p)} me={me} selected={selected} onSelect={setSelected} />
                <button onClick={() => askLocation()} className="absolute right-3 bottom-3 z-[500] grid size-11 place-items-center rounded-full bg-white text-espresso-600 shadow-[var(--shadow-card)]" aria-label="Lokasi saya">
                  <Icon name="locate" size={20} />
                </button>
              </div>
              {rows}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
