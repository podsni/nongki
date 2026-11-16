"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, FACILITIES, PRICE_LABEL } from "@/lib/types";
import type { HoursRow, Wifi } from "@/lib/types";
import { Icon } from "../Icon";

export type FormValues = {
  name: string;
  address: string;
  area: string;
  lat: string;
  lng: string;
  rating: string;
  reviews: string;
  priceLevel: string;
  priceText: string;
  hours: HoursRow[];
  is24h: boolean;
  categories: string[];
  facilities: string[];
  phone: string;
  website: string;
  photoUrl: string;
  mapsUrl: string;
  description: string;
  isExample: boolean;
  wifi: Wifi[];
};

export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

type Src = Partial<{ [K in keyof FormValues]: unknown }> & Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

export function toForm(src: Src): FormValues {
  const hoursIn = Array.isArray(src.hours) ? (src.hours as HoursRow[]) : [];
  return {
    name: s(src.name),
    address: s(src.address),
    area: s(src.area),
    lat: s(src.lat),
    lng: s(src.lng),
    rating: s(src.rating),
    reviews: s(src.reviews),
    priceLevel: s(src.priceLevel),
    priceText: s(src.priceText),
    hours: DAYS.map((d) => ({ day: d, text: hoursIn.find((h) => h.day.toLowerCase() === d.toLowerCase())?.text ?? "" })),
    is24h: !!src.is24h,
    categories: Array.isArray(src.categories) ? (src.categories as string[]) : [],
    facilities: Array.isArray(src.facilities) ? (src.facilities as string[]) : ["wifi"],
    phone: s(src.phone),
    website: s(src.website),
    photoUrl: s(src.photoUrl),
    mapsUrl: s(src.mapsUrl),
    description: s(src.description),
    isExample: !!src.isExample,
    wifi: Array.isArray(src.wifi) ? (src.wifi as Wifi[]).map((w) => ({ ...w })) : [],
  };
}

const newId = () => "w" + Math.random().toString(36).slice(2, 10);
const inputCls = "h-11 w-full rounded-[12px] border border-line bg-white px-3 text-sm outline-none focus:border-espresso-600";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-semibold text-ink-900">{label}</span>
      {children}
    </label>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-[18px] border border-line bg-white p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function WifiEditor({ wifi, onChange }: { wifi: Wifi[]; onChange: (w: Wifi[]) => void }) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const set = (i: number, patch: Partial<Wifi>) => onChange(wifi.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  return (
    <div className="space-y-3">
      {wifi.length === 0 && <p className="rounded-[12px] bg-cream-100 px-3 py-3 text-sm text-ink-500">Belum ada WiFi. Tambahkan satu atau lebih jaringan.</p>}
      {wifi.map((w, i) => (
        <div key={w.id} className="space-y-3 rounded-[14px] border border-line bg-cream-50 p-3" data-testid="wifi-row">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-espresso-600">
              <Icon name="wifi" size={16} /> WiFi #{i + 1}
            </span>
            <button type="button" onClick={() => onChange(wifi.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-xs font-semibold text-slow-600 hover:bg-slow-100" aria-label={`Hapus WiFi ${w.ssid || i + 1}`}>
              <Icon name="trash" size={14} /> Hapus
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nama WiFi (SSID) *">
              <input className={inputCls} value={w.ssid} onChange={(e) => set(i, { ssid: e.target.value })} placeholder="mis. NOGO_KELING" required name={`wifi-ssid-${i}`} />
            </Field>
            <Field label="Password">
              <div className="flex h-11 items-center rounded-[12px] border border-line bg-white pr-2 focus-within:border-espresso-600">
                <input className="h-full w-full bg-transparent px-3 text-sm outline-none" type={shown[w.id] ? "text" : "password"} value={w.password} onChange={(e) => set(i, { password: e.target.value })} placeholder="kosongkan jika terbuka" autoComplete="off" name={`wifi-pass-${i}`} />
                <button type="button" onClick={() => setShown((x) => ({ ...x, [w.id]: !x[w.id] }))} className="text-espresso-600" aria-label="Tampilkan password">
                  <Icon name={shown[w.id] ? "eyeoff" : "eye"} size={17} />
                </button>
              </div>
            </Field>
            <Field label="Catatan / lokasi">
              <input className={inputCls} value={w.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="mis. lantai 2, area outdoor" name={`wifi-note-${i}`} />
            </Field>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...wifi, { id: newId(), ssid: "", password: "", note: "" }])} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-espresso-400 text-sm font-semibold text-espresso-600 hover:bg-cream-100">
        <Icon name="plus" size={16} /> Tambah WiFi
      </button>
    </div>
  );
}

export function PlaceForm({ initial, placeId, extracted }: { initial: FormValues; placeId?: string; extracted?: string[] }) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const toggle = (k: "categories" | "facilities", key: string) => set(k, v[k].includes(key) ? v[k].filter((x) => x !== key) : [...v[k], key]);
  const got = (k: string) => extracted?.includes(k);
  const badge = (k: string) => (got(k) ? <span className="ml-1 rounded-full bg-mint-100 px-1.5 py-0.5 text-[10px] font-bold text-mint-600">dari Maps</span> : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setOk("");
    const body = { ...v, hours: v.is24h ? DAYS.map((d) => ({ day: d, text: "Buka 24 jam" })) : v.hours.filter((h) => h.text.trim()), wifi: v.wifi.filter((w) => w.ssid.trim()) };
    const res = await fetch(placeId ? `/api/admin/places/${placeId}` : "/api/admin/places", { method: placeId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({ error: "Respons tidak valid" }));
    setBusy(false);
    if (!j.ok) return setErr(j.error || "Gagal menyimpan");
    if (placeId) {
      setOk("Perubahan disimpan.");
      router.refresh();
    } else router.push(`/admin/tempat/${j.place.id}?baru=1`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-28">
      <Card title="Info utama">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nama tempat *" className="md:col-span-2">
            <input className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} required name="name" />
          </Field>
          <Field label="Alamat" className="md:col-span-2">
            <textarea className={`${inputCls} h-20 py-2`} value={v.address} onChange={(e) => set("address", e.target.value)} name="address" />
          </Field>
          <Field label="Area / kecamatan">
            <input className={inputCls} value={v.area} onChange={(e) => set("area", e.target.value)} placeholder="mis. Lowokwaru, Malang" />
          </Field>
          <Field label="Telepon">
            <input className={inputCls} value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Latitude">
            <input className={inputCls} value={v.lat} onChange={(e) => set("lat", e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Longitude">
            <input className={inputCls} value={v.lng} onChange={(e) => set("lng", e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Rating (0–5)">
            <input className={inputCls} value={v.rating} onChange={(e) => set("rating", e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Jumlah ulasan">
            <input className={inputCls} value={v.reviews} onChange={(e) => set("reviews", e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Level harga">
            <select className={inputCls} value={v.priceLevel} onChange={(e) => set("priceLevel", e.target.value)}>
              <option value="">—</option>
              {Object.entries(PRICE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kisaran harga">
            <input className={inputCls} value={v.priceText} onChange={(e) => set("priceText", e.target.value)} placeholder="Rp 25.000–50.000" />
          </Field>
          <Field label="Website">
            <input className={inputCls} value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Link Google Maps">
            <input className={inputCls} value={v.mapsUrl} onChange={(e) => set("mapsUrl", e.target.value)} />
          </Field>
          <Field label="Foto (URL https)" className="md:col-span-2">
            <div className="flex gap-3">
              <input className={inputCls} value={v.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://…" />
              {v.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.photoUrl} alt="" referrerPolicy="no-referrer" className="h-11 w-16 shrink-0 rounded-[10px] object-cover" />
              )}
            </div>
          </Field>
          <Field label="Deskripsi singkat" className="md:col-span-2">
            <textarea className={`${inputCls} h-20 py-2`} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="WiFi di tempat ini" right={<span className="text-xs text-ink-500">{v.wifi.length} jaringan</span>}>
        <WifiEditor wifi={v.wifi} onChange={(w) => set("wifi", w)} />
      </Card>

      <Card title="Kategori & fasilitas">
        <div className="space-y-2">
          <p className="text-xs font-semibold">Kategori {badge("kategori")}</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = v.categories.includes(c.key);
              return (
                <button type="button" key={c.key} onClick={() => toggle("categories", c.key)} aria-pressed={on} className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${on ? "border-espresso-600 bg-espresso-600 text-white" : "border-line bg-white text-ink-900"}`}>
                  <Icon name={c.icon} size={15} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold">Fasilitas</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FACILITIES.map((f) => {
              const on = v.facilities.includes(f.key);
              return (
                <button type="button" key={f.key} onClick={() => toggle("facilities", f.key)} aria-pressed={on} className={`flex h-11 items-center gap-2 rounded-[12px] border px-3 text-sm font-semibold ${on ? "border-mint-600 bg-mint-100 text-mint-600" : "border-line bg-white text-ink-500"}`}>
                  <Icon name={on ? "check" : f.icon} size={16} strokeWidth={on ? 3 : 2} /> {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card
        title="Jam buka"
        right={
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={v.is24h} onChange={(e) => set("is24h", e.target.checked)} className="size-4 accent-[#6b3f26]" /> Buka 24 jam
          </label>
        }
      >
        {!v.is24h && (
          <div className="grid gap-2 sm:grid-cols-2">
            {v.hours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm font-semibold">{h.day}</span>
                <input className={inputCls} value={h.text} onChange={(e) => set("hours", v.hours.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="08.00–23.00 / Tutup" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {v.isExample && (
        <label className="flex items-center gap-2 rounded-[14px] bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-500">
          <input type="checkbox" checked={v.isExample} onChange={(e) => set("isExample", e.target.checked)} className="size-4" /> Tandai sebagai data contoh
        </label>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            {err && <p className="font-semibold text-slow-600">{err}</p>}
            {ok && <p className="font-semibold text-mint-600">{ok}</p>}
          </div>
          <button disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-espresso-600 px-5 font-semibold text-white disabled:opacity-50">
            <Icon name="save" size={18} /> {busy ? "Menyimpan…" : placeId ? "Simpan perubahan" : "Simpan tempat"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function DeleteButton({ id, name, redirect }: { id: string; name: string; redirect?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Hapus "${name}" beserta riwayat tesnya?`)) return;
        setBusy(true);
        const res = await fetch(`/api/admin/places/${id}`, { method: "DELETE" });
        setBusy(false);
        if (res.ok) {
          if (redirect) router.push(redirect);
          router.refresh();
        } else alert("Gagal menghapus");
      }}
      className="inline-flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-xs font-semibold text-slow-600 hover:bg-slow-100 disabled:opacity-50"
    >
      <Icon name="trash" size={13} /> {busy ? "Menghapus…" : "Hapus"}
    </button>
  );
}

export function DeleteSpeedButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm("Hapus hasil tes ini?")) return;
        const res = await fetch(`/api/admin/speeds/${id}`, { method: "DELETE" });
        if (res.ok) router.refresh();
      }}
      className="rounded-[8px] p-1.5 text-slow-600 hover:bg-slow-100"
      aria-label="Hapus hasil tes"
    >
      <Icon name="trash" size={14} />
    </button>
  );
}
