"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, FACILITIES, PRICE_LABEL } from "@/lib/types";
import type { Wifi } from "@/lib/types";
import { DAYS, joinMenu, type FormValues, type MenuRow } from "@/lib/form";
export { toForm, type FormValues } from "@/lib/form";
import { photoSize } from "@/lib/util";
import { Icon } from "../Icon";

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

function PhotoEditor({ photos, mapsUrl, onChange }: { photos: string[]; mapsUrl: string; onChange: (p: string[]) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function refetch() {
    if (!mapsUrl) return setMsg("Isi dulu Link Google Maps di atas.");
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: mapsUrl }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Gagal");
      const fresh: string[] = j.draft.photos || [];
      const key = (u: string) => u.replace(/=[^/]*$/, "");
      const freshKeys = new Set(fresh.map(key));
      const manual = photos.filter((p) => !/googleusercontent\.com\//.test(p) && !freshKeys.has(key(p)));
      onChange([...fresh, ...manual]);
      setMsg(fresh.length ? `${fresh.length} foto diambil dari Google Maps. Klik Simpan untuk menyimpan.` : "Tidak ada foto yang bisa diambil dari Maps.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const move = (i: number, to: number) => {
    const a = [...photos];
    const [x] = a.splice(i, 1);
    a.splice(to, 0, x);
    onChange(a);
  };
  return (
    <div className="space-y-3">
      {photos.length === 0 ? (
        <p className="rounded-[12px] bg-cream-100 px-3 py-3 text-sm text-ink-500">Belum ada foto. Ambil dari Google Maps atau tempel URL foto.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {photos.map((p, i) => (
            <div key={p} className="group relative aspect-square overflow-hidden rounded-[12px] bg-cream-200" data-testid="photo-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSize(p, 240, 240)} alt={`Foto ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
              {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-espresso-900/85 px-2 py-0.5 text-[10px] font-bold text-white">Sampul</span>}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                {i > 0 ? (
                  <button type="button" onClick={() => move(i, 0)} className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-espresso-900" aria-label="Jadikan sampul">
                    Sampul
                  </button>
                ) : <span />}
                <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} className="grid size-6 place-items-center rounded-full bg-white/90 text-slow-600" aria-label={`Hapus foto ${i + 1}`}>
                  <Icon name="x" size={13} strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Tempel URL foto (https://…)" />
        <button
          type="button"
          onClick={() => {
            if (!/^https:\/\//.test(url.trim())) return setMsg("URL foto harus diawali https://");
            onChange([...photos, url.trim()]);
            setUrl("");
            setMsg("");
          }}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[12px] border border-line px-4 text-sm font-semibold"
        >
          <Icon name="plus" size={16} /> Tambah
        </button>
        <button type="button" onClick={refetch} disabled={busy} className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[12px] bg-cream-100 px-4 text-sm font-semibold text-espresso-600 disabled:opacity-50">
          <Icon name={busy ? "loader" : "refresh"} size={16} className={busy ? "animate-spin" : ""} /> {busy ? "Mengambil…" : "Ambil ulang dari Maps"}
        </button>
      </div>
      {msg && <p className="text-xs font-semibold text-espresso-600">{msg}</p>}
    </div>
  );
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const rupiah = (raw: string) => {
  const d = raw.replace(/[^\d]/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};

function PriceInput({ value, onChange, name, label }: { value: string; onChange: (v: string) => void; name: string; label: string }) {
  return (
    <div className="flex h-11 items-center rounded-[12px] border border-line bg-white focus-within:border-espresso-600">
      <span className="pl-3 text-sm font-semibold text-ink-500">Rp</span>
      <input className="h-full w-full bg-transparent px-2 text-sm outline-none" inputMode="numeric" value={rupiah(value)} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} placeholder="18.000" name={name} aria-label={label} />
    </div>
  );
}

function MenuEditor({ americano, menu, onAmericano, onMenu }: { americano: MenuRow; menu: MenuRow[]; onAmericano: (a: MenuRow) => void; onMenu: (m: MenuRow[]) => void }) {
  const setRow = (i: number, patch: Partial<MenuRow>) => onMenu(menu.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-[14px] border border-caramel-500/40 bg-cream-50 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-espresso-600">
          <Icon name="coffee" size={16} /> Americano
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Harga">
            <PriceInput value={americano.price} onChange={(price) => onAmericano({ ...americano, price, checkedAt: americano.checkedAt || (price ? today() : "") })} name="americano-price" label="Harga Americano" />
          </Field>
          <Field label="Ukuran / catatan">
            <input className={inputCls} value={americano.note} onChange={(e) => onAmericano({ ...americano, note: e.target.value })} placeholder="mis. 12 oz, panas" name="americano-note" />
          </Field>
          <Field label="Terakhir dicek">
            <div className="flex gap-2">
              <input type="date" className={inputCls} value={americano.checkedAt} onChange={(e) => onAmericano({ ...americano, checkedAt: e.target.value })} name="americano-checked" />
              <button type="button" onClick={() => onAmericano({ ...americano, checkedAt: today() })} className="h-11 shrink-0 rounded-[12px] border border-line px-3 text-xs font-semibold">
                Hari ini
              </button>
            </div>
          </Field>
        </div>
        {americano.price && (
          <button type="button" onClick={() => onAmericano({ ...americano, price: "", note: "", checkedAt: "" })} className="text-xs font-semibold text-slow-600">
            Hapus harga Americano
          </button>
        )}
      </div>
      {menu.map((m, i) => (
        <div key={m.id || i} className="grid gap-2 rounded-[14px] border border-line p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Menu">
            <input className={inputCls} value={m.item} onChange={(e) => setRow(i, { item: e.target.value })} placeholder="mis. Kopi susu gula aren" />
          </Field>
          <Field label="Harga">
            <PriceInput value={m.price} onChange={(price) => setRow(i, { price })} name={`menu-price-${i}`} label={`Harga ${m.item || "menu"}`} />
          </Field>
          <Field label="Catatan">
            <input className={inputCls} value={m.note} onChange={(e) => setRow(i, { note: e.target.value })} placeholder="ukuran / varian" />
          </Field>
          <Field label="Dicek">
            <input type="date" className={inputCls} value={m.checkedAt} onChange={(e) => setRow(i, { checkedAt: e.target.value })} />
          </Field>
          <button type="button" onClick={() => onMenu(menu.filter((_, j) => j !== i))} className="inline-flex h-11 items-center justify-center gap-1 rounded-[12px] px-3 text-xs font-semibold text-slow-600 hover:bg-slow-100" aria-label="Hapus menu">
            <Icon name="trash" size={14} /> Hapus
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onMenu([...menu, { id: "", item: "", price: "", note: "", checkedAt: today() }])} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-espresso-400 text-sm font-semibold text-espresso-600 hover:bg-cream-100">
        <Icon name="plus" size={16} /> Tambah harga menu lain
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
    const body = { ...v, hours: v.is24h ? DAYS.map((d) => ({ day: d, text: "Buka 24 jam" })) : v.hours.filter((h) => h.text.trim()), wifi: v.wifi.filter((w) => w.ssid.trim()), menu: joinMenu(v) };
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
          <Field label="Deskripsi singkat" className="md:col-span-2">
            <textarea className={`${inputCls} h-20 py-2`} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Foto & galeri" right={<span className="text-xs text-ink-500">{v.photos.length} foto</span>}>
        <PhotoEditor photos={v.photos} mapsUrl={v.mapsUrl} onChange={(ph) => set("photos", ph)} />
      </Card>

      <Card title="Harga menu" right={<span className="text-xs text-ink-500">opsional</span>}>
        <MenuEditor americano={v.americano} menu={v.menu} onAmericano={(a) => set("americano", a)} onMenu={(m) => set("menu", m)} />
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
