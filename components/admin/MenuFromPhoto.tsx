"use client";
import { useMemo, useRef, useState } from "react";
import type { MenuPrice } from "@/lib/types";
import { cleanItems, parseMenuText, parseRupiah, type ExtractedItem } from "@/lib/menuparse";
import { fmtRp, photoSize } from "@/lib/util";
import { Icon } from "../Icon";

type Row = ExtractedItem & { key: string; on: boolean; exists: MenuPrice | null; priceText: string };
type Upload = { id: string; name: string; dataUrl: string };
type Msg = { tone: "ok" | "err" | "info"; text: string } | null;

const MAX_PICK = 6;
const inputCls = "h-10 w-full min-w-0 rounded-[10px] border border-line bg-white px-2.5 text-sm outline-none focus:border-espresso-600";
const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-semibold disabled:opacity-50";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
const keyOf = (item: string, note = "") => `${item}|${note}`.toLowerCase().replace(/[^a-z0-9|]+/g, "");
const rid = () => Math.random().toString(36).slice(2, 10);

/** Kecilkan foto di browser (maks. 1600 px, JPEG) sebelum dikirim. */
async function compress(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  const tone = msg.tone === "ok" ? "bg-mint-100 text-mint-600" : msg.tone === "err" ? "bg-slow-100 text-slow-600" : "bg-cream-100 text-espresso-700";
  return <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold ${tone}`}>{msg.text}</p>;
}

export function MenuFromPhoto({ placeId, photos, menu }: { placeId: string; photos: string[]; menu: MenuPrice[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [engine, setEngine] = useState<"ai" | "ocr" | null>(null);
  const [checkedAt, setCheckedAt] = useState(today());
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirm, setConfirm] = useState("");
  const [amReplace, setAmReplace] = useState(false);
  const [allPhotos, setAllPhotos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingAm = useMemo(() => menu.find((m) => /americano/i.test(m.item)) ?? null, [menu]);
  const index = useMemo(() => new Map(menu.map((m) => [keyOf(m.item, m.note), m])), [menu]);
  const total = picked.length + uploads.length;

  function toRows(items: ExtractedItem[]): Row[] {
    return items.map((it) => {
      const exists = index.get(keyOf(it.item, it.note)) ?? null;
      return { ...it, key: rid(), on: !exists, exists, priceText: String(it.price) };
    });
  }

  function togglePick(u: string) {
    setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length + uploads.length >= MAX_PICK ? p : [...p, u]));
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PICK - total;
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) setMsg({ tone: "info", text: `Maksimal ${MAX_PICK} foto sekali baca.` });
    setBusy("compress");
    try {
      const out: Upload[] = [];
      for (const f of list) out.push({ id: rid(), name: f.name, dataUrl: await compress(f) });
      setUploads((u) => [...u, ...out]);
    } catch {
      setMsg({ tone: "err", text: "Foto tidak bisa dibaca. Coba format JPG/PNG." });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runOcr() {
    setBusy("ocr");
    setEngine("ocr");
    setMsg({ tone: "info", text: "Membaca teks dengan OCR di browser… (pertama kali mengunduh data bahasa ±10 MB)" });
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["ind", "eng"]);
      let all: ExtractedItem[] = [];
      const sources = [...picked.map((u) => `/api/admin/menu/photo?u=${encodeURIComponent(u)}`), ...uploads.map((u) => u.dataUrl)];
      for (const s of sources) {
        const { data } = await worker.recognize(s);
        all = all.concat(parseMenuText(data.text));
      }
      await worker.terminate();
      const items = cleanItems(all);
      setRows(toRows(items));
      setUnreadable([]);
      setMsg(items.length ? { tone: "info", text: `OCR menemukan ${items.length} baris. OCR kurang akurat untuk tulisan tangan/papan kapur — cek & perbaiki sebelum menyimpan.` } : { tone: "err", text: "OCR tidak menemukan pasangan nama + harga. Coba foto yang lebih jelas/lurus, atau isi manual." });
    } catch (e) {
      setMsg({ tone: "err", text: "OCR gagal: " + (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function read() {
    setCheckedAt(uploads.length ? today() : "");
    if (!total) return setMsg({ tone: "err", text: "Pilih foto menu dari galeri atau unggah foto dulu." });
    setBusy("ai");
    setMsg({ tone: "info", text: "Membaca menu dengan AI… (±10–30 detik)" });
    try {
      const res = await fetch("/api/admin/menu/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: picked, images: uploads.map((u) => u.dataUrl) }) });
      const j = await res.json().catch(() => ({ ok: false, error: `Server error (${res.status})` }));
      if (res.status === 503 && j.code === "no-ai") {
        setBusy(null);
        setMsg({ tone: "info", text: j.error });
        return runOcr();
      }
      if (!j.ok) throw new Error(j.error || "Gagal membaca menu");
      setEngine("ai");
      setRows(toRows(j.items));
      setUnreadable(j.unreadable || []);
      setMsg(j.items.length ? { tone: "ok", text: `Terbaca ${j.items.length} item. Cek lagi nama & harga sebelum disimpan.` } : { tone: "err", text: j.isMenu ? "Menu terlihat, tapi harganya tidak terbaca jelas." : "Foto yang dipilih sepertinya bukan foto menu." });
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy((b) => (b === "ai" ? null : b));
    }
  }

  const setRow = (k: string, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const chosen = (rows || []).filter((r) => r.on && r.item.trim() && parseRupiah(r.priceText));
  const amFound = (rows || []).find((r) => /^(ice |iced |hot )?americano$/i.test(r.item.trim()) && parseRupiah(r.priceText));
  const amDiff = !!(existingAm && amFound && parseRupiah(amFound.priceText) !== existingAm.price);
  const replaceOk = mode === "merge" || confirm.trim().toUpperCase() === "GANTI";

  async function save() {
    setBusy("save");
    try {
      const items = chosen.map((r) => ({ item: r.item.trim(), price: parseRupiah(r.priceText), note: r.note.trim(), category: r.category.trim(), checkedAt, source: "foto" }));
      let added = 0, updated = 0, skipped = 0;
      if (items.length) {
        const res = await fetch(`/api/admin/places/${placeId}/menu`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, mode, confirm }) });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error);
        ({ added, updated, skipped } = j);
      }
      if (amReplace && existingAm && amFound) {
        const res = await fetch(`/api/admin/places/${placeId}/menu`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ item: existingAm.item, note: existingAm.note, price: parseRupiah(amFound.priceText), checkedAt }], mode: "merge", update: true }) });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error);
        updated += j.updated;
      }
      setMsg({ tone: "ok", text: `Menu tersimpan: ${added} baru${updated ? `, ${updated} diperbarui` : ""}${skipped ? `, ${skipped} dilewati (sudah ada)` : ""}. Memuat ulang…` });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
      setBusy(null);
    }
  }

  return (
    <section id="menu-foto" className="scroll-mt-20 space-y-4 rounded-[18px] border border-line bg-white p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-caramel-100 text-espresso-600">
          <Icon name="list" size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold">Menu dari foto</h2>
          <p className="text-sm text-ink-500">Pilih foto menu dari galeri Maps atau unggah foto (kamera HP boleh). Nama & harga dibaca otomatis, lalu kamu cek dulu sebelum disimpan.</p>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">
            Galeri Google Maps <span className="font-normal text-ink-500">· ketuk foto yang berisi menu/papan harga ({total}/{MAX_PICK})</span>
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {photos.map((u, i) => ({ u, i })).filter(({ u, i }) => allPhotos || i < 12 || picked.includes(u)).map(({ u, i }) => {
              const on = picked.includes(u);
              return (
                <button type="button" key={u} onClick={() => togglePick(u)} aria-pressed={on} aria-label={`Foto ${i + 1}${on ? " (dipilih)" : ""}`} className={`relative aspect-square overflow-hidden rounded-[10px] border-2 ${on ? "border-espresso-600" : "border-transparent"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoSize(u, 240, 240)} alt="" loading="lazy" className="size-full object-cover" />
                  {on && <span className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-espresso-600 text-white"><Icon name="check" size={14} /></span>}
                </button>
              );
            })}
          </div>
          {photos.length > 12 && (
            <button type="button" onClick={() => setAllPhotos((v) => !v)} className="h-9 text-xs font-semibold text-espresso-600">
              {allPhotos ? "Tampilkan lebih sedikit" : `Tampilkan semua ${photos.length} foto`}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btn} cursor-pointer border border-line bg-white text-ink-900 hover:border-espresso-400`}>
          <Icon name="upload" size={18} /> {busy === "compress" ? "Menyiapkan…" : "Unggah foto menu"}
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
        </label>
        {uploads.map((u) => (
          <span key={u.id} className="relative size-11 overflow-hidden rounded-[10px] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u.dataUrl} alt={u.name} className="size-full object-cover" />
            <button type="button" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))} aria-label={`Hapus ${u.name}`} className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 hover:opacity-100 focus:opacity-100">
              <Icon name="x" size={16} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={read} disabled={!!busy || !total} className={`${btn} bg-espresso-600 text-white`}>
          <Icon name="zap" size={18} /> {busy === "ai" ? "Membaca…" : `Baca menu (${total} foto)`}
        </button>
        <button type="button" onClick={runOcr} disabled={!!busy || !total} className={`${btn} border border-line bg-white text-ink-900`}>
          {busy === "ocr" ? "OCR berjalan…" : "Pakai OCR di browser"}
        </button>
        <button type="button" onClick={() => setRows((r) => [...(r || []), { key: rid(), category: "", item: "", price: 0, note: "", priceText: "", on: true, exists: null }])} className={`${btn} text-espresso-600`}>
          <Icon name="plus" size={18} /> Isi manual
        </button>
      </div>
      <Notice msg={msg} />

      {rows && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              Hasil {engine === "ai" ? "AI" : engine === "ocr" ? "OCR" : ""} · {chosen.length} dari {rows.length} dipilih
            </p>
            <div className="flex gap-2 text-xs font-semibold">
              <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, on: true })))} className="h-9 rounded-[10px] border border-line px-3">Pilih semua</button>
              <button type="button" onClick={() => setRows(rows.map((r) => ({ ...r, on: false })))} className="h-9 rounded-[10px] border border-line px-3">Kosongkan</button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="hidden grid-cols-[28px_1.4fr_1fr_1fr_110px_36px] gap-2 px-1 text-[11px] font-semibold text-ink-500 md:grid">
              <span />
              <span>Nama menu</span>
              <span>Kategori</span>
              <span>Varian / catatan</span>
              <span>Harga (Rp)</span>
              <span />
            </div>
            {rows.map((r) => {
              const price = parseRupiah(r.priceText);
              return (
                <div key={r.key} className={`grid grid-cols-[28px_1fr_36px] gap-2 rounded-[12px] border p-2 md:grid-cols-[28px_1.4fr_1fr_1fr_110px_36px] md:items-center md:border-0 md:p-1 ${r.on ? "border-line" : "border-line opacity-60"}`}>
                  <input type="checkbox" checked={r.on} onChange={(e) => setRow(r.key, { on: e.target.checked })} aria-label={`Simpan ${r.item || "baris"}`} className="mt-3 size-5 accent-espresso-600 md:mt-0" />
                  <div className="grid grid-cols-2 gap-2 md:contents">
                    <input className={`${inputCls} col-span-2 md:col-span-1`} value={r.item} onChange={(e) => setRow(r.key, { item: e.target.value })} placeholder="Nama menu" aria-label="Nama menu" />
                    <input className={inputCls} value={r.category} onChange={(e) => setRow(r.key, { category: e.target.value })} placeholder="Kategori" aria-label="Kategori" />
                    <input className={inputCls} value={r.note} onChange={(e) => setRow(r.key, { note: e.target.value })} placeholder="Hot/Ice, ukuran…" aria-label="Varian" />
                    <div className="col-span-2 md:col-span-1">
                      <input className={`${inputCls} ${r.priceText && !price ? "border-slow-600" : ""}`} value={r.priceText} inputMode="numeric" onChange={(e) => setRow(r.key, { priceText: e.target.value })} placeholder="25000 / 25K" aria-label="Harga" />
                      {r.exists && <p className="mt-1 text-[11px] font-semibold text-amber-500">Sudah ada: {fmtRp(r.exists.price)}</p>}
                    </div>
                  </div>
                  <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} aria-label="Hapus baris" className="grid size-9 place-items-center rounded-[10px] text-slow-600 hover:bg-slow-100">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          {unreadable.length > 0 && <p className="rounded-[12px] bg-amber-100 px-3 py-2 text-xs text-espresso-700">Harga tidak terbaca (tidak ikut disimpan): {unreadable.join(", ")}</p>}

          {amDiff && existingAm && amFound && (
            <label className="flex items-start gap-3 rounded-[14px] border border-caramel-500/50 bg-cream-50 p-3 text-sm">
              <input type="checkbox" checked={amReplace} onChange={(e) => setAmReplace(e.target.checked)} className="mt-0.5 size-5 accent-espresso-600" />
              <span>
                Foto menunjukkan <b>Americano {fmtRp(parseRupiah(amFound.priceText))}</b>, sedangkan harga Americano tersimpan <b>{fmtRp(existingAm.price)}</b>
                {existingAm.checkedAt ? ` (dicek ${existingAm.checkedAt})` : ""}. Perbarui harga Americano?
              </span>
            </label>
          )}
          {!existingAm && amFound && <p className="text-xs text-ink-500">Americano {fmtRp(parseRupiah(amFound.priceText))} akan otomatis tampil sebagai harga Americano tempat ini.</p>}

          <div className="grid gap-3 rounded-[14px] bg-cream-50 p-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold">Harga per tanggal <span className="font-normal text-ink-500">(kosongkan bila tanggal foto tidak diketahui)</span></span>
              <input type="date" className={inputCls} value={checkedAt} onChange={(e) => setCheckedAt(e.target.value)} />
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold">Cara simpan</legend>
              <div className="flex gap-2">
                {(["merge", "replace"] as const).map((m) => (
                  <label key={m} className={`flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold ${mode === m ? (m === "replace" ? "border-slow-600 bg-slow-100 text-slow-600" : "border-espresso-600 bg-white text-espresso-600") : "border-line bg-white text-ink-500"}`}>
                    <input type="radio" name="menu-mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
                    {m === "merge" ? "Gabungkan" : "Ganti semua"}
                  </label>
                ))}
              </div>
            </fieldset>
            {mode === "replace" && (
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs text-ink-500">Seluruh menu sekarang ({menu.length} item, termasuk Americano) akan diganti. Ketik <b className="font-mono text-slow-600">GANTI</b>:</span>
                <input className={`${inputCls} font-mono uppercase`} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="GANTI" />
              </label>
            )}
          </div>
          <button type="button" onClick={save} disabled={!!busy || (!chosen.length && !amReplace) || !replaceOk} className={`${btn} w-full bg-espresso-600 text-white`}>
            {busy === "save" ? "Menyimpan…" : `Simpan ${chosen.length} item ke menu`}
          </button>
          <p className="text-xs text-ink-500">Disimpan langsung ke tempat ini (WiFi & data lain tidak berubah). Perubahan form di atas yang belum disimpan akan hilang karena halaman dimuat ulang.</p>
        </div>
      )}
    </section>
  );
}
