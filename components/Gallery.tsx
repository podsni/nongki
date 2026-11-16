"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { photoSize } from "@/lib/util";
import { Icon } from "./Icon";

type Props = { photos: string[]; name: string; fallback: string };

/* eslint-disable @next/next/no-img-element */
function Img({ src, w, h, className = "", alt, eager = false }: { src: string; w: number; h: number; className?: string; alt: string; eager?: boolean }) {
  return <img src={photoSize(src, w, h)} alt={alt} className={className} loading={eager ? "eager" : "lazy"} referrerPolicy="no-referrer" decoding="async" draggable={false} />;
}

export function Lightbox({ photos, name, index, onClose }: { photos: string[]; name: string; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => setI((x) => (x + d + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  useEffect(() => {
    thumbs.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    // pre-load tetangga
    [i + 1, i - 1].forEach((k) => {
      const u = photos[(k + photos.length) % photos.length];
      if (u) new Image().src = photoSize(u, 1600, 1200);
    });
  }, [i, photos]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Foto ${name}`} className="fixed inset-0 z-[1000] flex flex-col bg-black text-white" data-testid="lightbox">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-sm font-semibold tabular-nums">
          {i + 1} / {photos.length}
        </span>
        <span className="hidden truncate px-4 text-sm text-white/70 sm:block">{name} · Foto dari Google Maps</span>
        <button onClick={onClose} aria-label="Tutup galeri" className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <Icon name="x" size={20} />
        </button>
      </div>
      <div
        className="relative min-h-0 flex-1 select-none"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          else if (dy > 90) onClose();
        }}
      >
        <Img key={i} src={photos[i]} w={1600} h={1200} alt={`${name} — foto ${i + 1}`} eager className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />
        {photos.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Foto sebelumnya" className="absolute top-1/2 left-3 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 sm:grid">
              <Icon name="chev" size={22} className="rotate-180" />
            </button>
            <button onClick={() => go(1)} aria-label="Foto berikutnya" className="absolute top-1/2 right-3 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 hover:bg-white/25 sm:grid">
              <Icon name="chev" size={22} />
            </button>
          </>
        )}
      </div>
      <div ref={thumbs} className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 py-3">
        {photos.map((p, k) => (
          <button key={p} data-i={k} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`} className={`h-14 w-20 shrink-0 overflow-hidden rounded-[8px] ring-2 transition ${k === i ? "opacity-100 ring-caramel-500" : "opacity-50 ring-transparent hover:opacity-80"}`}>
            <Img src={p} w={160} h={112} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>
      <p className="pb-3 text-center text-[11px] text-white/50 sm:hidden">Geser untuk foto lain · geser ke bawah untuk menutup</p>
    </div>
  );
}

/** Hero galeri: carousel geser di HP, grid 1+4 di desktop. */
export function GalleryHero({ photos, name, fallback }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [cur, setCur] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  if (!photos.length) {
    return (
      <div className="relative h-64 md:h-[420px] md:rounded-[26px]" style={{ background: fallback }}>
        <div className="absolute inset-0 grid place-items-center text-white/35">
          <Icon name="coffee" size={56} />
        </div>
        <BackBtn />
      </div>
    );
  }
  const more = photos.length - 5;
  return (
    <>
      {/* HP / tablet kecil: carousel */}
      <div className="relative md:hidden">
        <div
          ref={strip}
          className="no-scrollbar flex h-72 snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setCur(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {photos.map((p, k) => (
            <button key={p} onClick={() => setOpen(k)} className="h-full w-full shrink-0 snap-center" aria-label={`Buka foto ${k + 1}`}>
              <Img src={p} w={800} h={600} alt={`${name} — foto ${k + 1}`} eager={k === 0} className="size-full object-cover" />
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        <BackBtn />
        <button onClick={() => setOpen(cur)} className="absolute right-4 bottom-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">
          <Icon name="folder" size={13} /> {cur + 1}/{photos.length}
        </button>
      </div>

      {/* Desktop: grid 1 besar + 4 kecil */}
      <div className={`hidden h-[420px] gap-2 overflow-hidden rounded-[26px] md:grid ${photos.length >= 5 ? "grid-cols-4 grid-rows-2" : photos.length >= 3 ? "grid-cols-3 grid-rows-2" : photos.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {photos.slice(0, 5).map((p, k) => (
          <button
            key={p}
            onClick={() => setOpen(k)}
            className={`group relative overflow-hidden bg-cream-200 ${k === 0 && photos.length >= 3 ? "col-span-2 row-span-2" : ""}`}
            aria-label={`Buka foto ${k + 1}`}
          >
            <Img src={p} w={k === 0 ? 1200 : 600} h={k === 0 ? 900 : 450} alt={`${name} — foto ${k + 1}`} eager={k === 0} className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            {k === Math.min(4, photos.length - 1) && photos.length > 1 && (
              <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-espresso-900 shadow">
                <Icon name="folder" size={13} /> {more > 0 ? `Lihat semua ${photos.length} foto` : "Lihat foto"}
              </span>
            )}
          </button>
        ))}
      </div>
      {open != null && <Lightbox photos={photos} name={name} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function BackBtn() {
  return (
    <Link href="/jelajah" aria-label="Kembali" className="absolute top-4 left-4 grid size-10 place-items-center rounded-full bg-white/90 text-espresso-900 md:hidden">
      <Icon name="back" size={20} />
    </Link>
  );
}

/** Grid semua foto di bagian Galeri. */
export function GalleryGrid({ photos, name }: { photos: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  if (!photos.length) return null;
  const shown = all ? photos : photos.slice(0, 12);
  return (
    <section className="space-y-3" id="galeri">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Galeri</h2>
        <span className="text-xs text-ink-500">{photos.length} foto dari Google Maps</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6">
        {shown.map((p, k) => (
          <button key={p} onClick={() => setOpen(k)} className="group relative aspect-square overflow-hidden rounded-[10px] bg-cream-200" aria-label={`Buka foto ${k + 1}`}>
            <Img src={p} w={360} h={360} alt={`${name} — foto ${k + 1}`} className="size-full object-cover transition duration-300 group-hover:scale-105" />
          </button>
        ))}
      </div>
      {photos.length > 12 && (
        <button onClick={() => setAll((a) => !a)} className="h-11 w-full rounded-[12px] border border-line bg-white text-sm font-semibold text-espresso-600 hover:bg-cream-100">
          {all ? "Tampilkan lebih sedikit" : `Tampilkan semua ${photos.length} foto`}
        </button>
      )}
      {open != null && <Lightbox photos={photos} name={name} index={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
