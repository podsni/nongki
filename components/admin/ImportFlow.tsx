"use client";
import { useState } from "react";
import { Icon } from "../Icon";
import { PlaceForm, toForm, type FormValues } from "./PlaceForm";

type Draft = Record<string, unknown> & { extracted: string[]; warnings: string[]; googleCategory: string; resolvedUrl: string };

export function ImportFlow() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [key, setKey] = useState(0);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Gagal mengambil data");
      setDraft(j.draft);
      setForm(toForm({ ...j.draft, facilities: ["wifi"] }));
      setKey((k) => k + 1);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="space-y-3 rounded-[18px] border border-line bg-white p-4 md:p-5">
        <div>
          <h1 className="text-xl font-extrabold">Tambah tempat dari Google Maps</h1>
          <p className="text-sm text-ink-500">Cukup tempel link Google Maps (maps.app.goo.gl/… atau google.com/maps/place/…). Data akan diisi otomatis, lalu kamu bisa lengkapi sebelum menyimpan.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex h-12 flex-1 items-center gap-2 rounded-[14px] border border-line px-3 focus-within:border-espresso-600">
            <Icon name="link" size={18} className="text-espresso-600" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" className="w-full bg-transparent text-sm outline-none" name="url" inputMode="url" required />
          </label>
          <button disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-espresso-600 px-5 font-semibold text-white disabled:opacity-50">
            <Icon name={busy ? "loader" : "download"} size={18} className={busy ? "animate-spin" : ""} /> {busy ? "Mengambil data…" : "Ambil data"}
          </button>
        </div>
        {err && <p className="rounded-[12px] bg-slow-100 px-3 py-2 text-sm font-semibold text-slow-600">{err}</p>}
        <button type="button" onClick={() => { setDraft(null); setForm(toForm({ facilities: ["wifi"] })); setKey((k) => k + 1); }} className="text-xs font-semibold text-ink-500 underline">
          Isi manual tanpa link
        </button>
      </form>

      {draft && (
        <div className="space-y-2 rounded-[18px] border border-mint-600/30 bg-mint-100 p-4 text-sm">
          <p className="flex items-center gap-2 font-bold text-mint-600">
            <Icon name="check" size={16} strokeWidth={3} /> Berhasil mengambil {draft.extracted.length} data dari Google Maps
          </p>
          <p className="text-ink-900">{draft.extracted.join(" · ")}</p>
          {draft.googleCategory && <p className="text-ink-500">Kategori Google: {draft.googleCategory}</p>}
          {draft.warnings.map((w) => (
            <p key={w} className="text-amber-500">
              ⚠ {w}
            </p>
          ))}
          <p className="text-ink-500">Lengkapi WiFi, fasilitas, dan kategori di bawah, lalu simpan.</p>
        </div>
      )}
      {form && <PlaceForm key={key} initial={form} extracted={draft?.extracted} />}
    </div>
  );
}
