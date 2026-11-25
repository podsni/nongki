"use client";
import { useRef, useState } from "react";
import { Icon } from "../Icon";

type Counts = { places: number; wifi: number; speeds: number; menu: number };
type Tally = { new: number; updated: number; unchanged: number; removed: number };
type Plan = { mode: "merge" | "replace"; places: Tally; wifi: Tally; speeds: Tally; menu: Tally; before: Counts; after: Counts; samples: { new: string[]; updated: string[]; removed: string[] } };
type Snapshot = { name: string; kind: "auto" | "manual"; label: string; createdAt: string; size: number; counts: Counts };
type Msg = { tone: "ok" | "err" | "info"; text: string } | null;

const CONFIRM_REPLACE = "GANTI";
const CONFIRM_RESTORE = "PULIHKAN";

const card = "rounded-[18px] border border-line bg-white p-4 md:p-5";
const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-semibold disabled:opacity-50";
const btnPrimary = `${btn} bg-espresso-600 text-white`;
const btnGhost = `${btn} border border-line bg-white text-ink-900 hover:border-espresso-400`;
const btnSm = "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[14px] border border-line bg-white px-3 text-sm font-semibold text-ink-900 hover:border-espresso-400 sm:flex-none";
const btnDanger = `${btn} bg-slow-600 text-white`;

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`);
const fmtWib = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) + " WIB";
const countText = (c: Counts) => `${c.places} tempat · ${c.wifi} WiFi · ${c.speeds} tes · ${c.menu} harga`;
const LABELS: Record<string, string> = { "sebelum-gabung": "Sebelum impor (gabung)", "sebelum-ganti": "Sebelum impor (ganti semua)", "sebelum-pulihkan": "Sebelum pemulihan" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const j = await res.json().catch(() => ({ ok: false, error: `Server error (${res.status})` }));
  if (res.status === 401) throw new Error("Sesi admin habis. Muat ulang halaman lalu login lagi.");
  if (!j.ok) throw new Error(j.error || "Gagal");
  return j as T;
}

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  const tone = msg.tone === "ok" ? "bg-mint-100 text-mint-600" : msg.tone === "err" ? "bg-slow-100 text-slow-600" : "bg-cream-100 text-espresso-700";
  return (
    <p role={msg.tone === "err" ? "alert" : "status"} className={`flex items-start gap-2 rounded-[14px] px-3 py-2.5 text-sm font-semibold ${tone}`}>
      <Icon name={msg.tone === "ok" ? "check" : msg.tone === "err" ? "x" : "info"} size={16} className="mt-0.5 shrink-0" />
      <span>{msg.text}</span>
    </p>
  );
}

function ConfirmWord({ word, value, onChange, id }: { word: string; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-sm text-ink-500">
        Ketik <b className="font-mono text-slow-600">{word}</b> untuk konfirmasi
      </span>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={word} className="h-11 w-full rounded-[14px] border border-line px-3 font-mono text-sm uppercase outline-none focus:border-slow-600" />
    </label>
  );
}

function PlanTable({ plan }: { plan: Plan }) {
  const rows: [string, Tally][] = [
    ["Tempat", plan.places],
    ["WiFi", plan.wifi],
    ["Hasil tes", plan.speeds],
    ["Harga menu", plan.menu],
  ];
  const cell = (n: number, cls: string) => <td className={`px-1.5 py-2 sm:px-2 text-right tabular-nums ${n ? cls : "text-ink-300"}`}>{n}</td>;
  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-500">
              <th className="px-1.5 py-1 sm:px-2 text-left font-semibold">Data</th>
              <th className="px-1.5 py-1 sm:px-2 text-right font-semibold">Baru</th>
              <th className="px-1.5 py-1 sm:px-2 text-right font-semibold">Berubah</th>
              <th className="px-1.5 py-1 sm:px-2 text-right font-semibold">Sama</th>
              <th className="px-1.5 py-1 sm:px-2 text-right font-semibold">Dihapus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([k, t]) => (
              <tr key={k}>
                <td className="whitespace-nowrap px-1.5 py-2 font-semibold sm:px-2">{k}</td>
                {cell(t.new, "font-bold text-mint-600")}
                {cell(t.updated, "font-bold text-amber-500")}
                {cell(t.unchanged, "text-ink-500")}
                {cell(t.removed, "font-bold text-slow-600")}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-500">
        Sekarang: {countText(plan.before)} → setelah impor: <b className="text-ink-900">{countText(plan.after)}</b>
      </p>
      {(["new", "updated", "removed"] as const).map((k) =>
        plan.samples[k].length ? (
          <p key={k} className="text-xs text-ink-500">
            <b className={k === "new" ? "text-mint-600" : k === "updated" ? "text-amber-500" : "text-slow-600"}>{k === "new" ? "Baru" : k === "updated" ? "Berubah" : "Dihapus"}:</b> {plan.samples[k].join(", ")}
          </p>
        ) : null,
      )}
    </div>
  );
}

export function BackupPanel({ counts, initial, maxBytes, keepAuto }: { counts: Counts; initial: Snapshot[]; maxBytes: number; keepAuto: number }) {
  const [now, setNow] = useState(counts);
  const [snaps, setSnaps] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  // impor
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; data: unknown } | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");
  const [importMsg, setImportMsg] = useState<Msg>(null);
  const [drag, setDrag] = useState(false);

  // riwayat
  const [histMsg, setHistMsg] = useState<Msg>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreWord, setRestoreWord] = useState("");

  async function refreshList() {
    const j = await api<{ snapshots: Snapshot[] }>("/api/admin/backup/snapshots");
    setSnaps(j.snapshots);
  }

  async function preview(data: unknown, m: "merge" | "replace") {
    setBusy("preview");
    setPlan(null);
    setWarnings([]);
    try {
      const j = await api<{ plan: Plan; warnings: string[] }>("/api/admin/backup/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: m, data }) });
      setPlan(j.plan);
      setWarnings(j.warnings);
      setImportMsg(null);
    } catch (e) {
      setImportMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setConfirm("");
    setPlan(null);
    setFile(null);
    if (!/\.json$/i.test(f.name) && f.type !== "application/json") return setImportMsg({ tone: "err", text: "Pilih file backup berformat .json (bukan CSV)." });
    if (f.size > maxBytes) return setImportMsg({ tone: "err", text: `File terlalu besar (${fmtSize(f.size)}). Maksimal ${fmtSize(maxBytes)}.` });
    let data: unknown;
    try {
      data = JSON.parse(await f.text());
    } catch {
      return setImportMsg({ tone: "err", text: "Isi file bukan JSON yang valid. Pastikan file tidak rusak atau terpotong." });
    }
    setFile({ name: f.name, size: f.size, data });
    await preview(data, mode);
  }

  function changeMode(m: "merge" | "replace") {
    setMode(m);
    setConfirm("");
    if (file) preview(file.data, m);
  }

  async function apply() {
    if (!file || !plan) return;
    setBusy("import");
    try {
      const j = await api<{ plan: Plan; snapshot: Snapshot }>("/api/admin/backup/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, confirm, data: file.data }) });
      setNow(j.plan.after);
      setImportMsg({ tone: "ok", text: `Impor berhasil: ${j.plan.places.new} tempat baru, ${j.plan.places.updated} diperbarui${j.plan.places.removed ? `, ${j.plan.places.removed} dihapus` : ""}. Data lama disimpan sebagai snapshot otomatis — bisa dipulihkan di Riwayat backup.` });
      setFile(null);
      setPlan(null);
      setConfirm("");
      if (fileRef.current) fileRef.current.value = "";
      await refreshList();
    } catch (e) {
      setImportMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function snapshotNow() {
    setBusy("snap");
    try {
      const j = await api<{ snapshot: Snapshot }>("/api/admin/backup/snapshots", { method: "POST" });
      setHistMsg({ tone: "ok", text: `Backup tersimpan: ${countText(j.snapshot.counts)}.` });
      await refreshList();
    } catch (e) {
      setHistMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function restore(name: string) {
    setBusy("restore");
    try {
      const j = await api<{ plan: Plan }>(`/api/admin/backup/snapshots/${encodeURIComponent(name)}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: restoreWord }) });
      setNow(j.plan.after);
      setHistMsg({ tone: "ok", text: `Data dipulihkan: ${countText(j.plan.after)}. Kondisi sebelumnya disimpan sebagai snapshot otomatis.` });
      setRestoring(null);
      setRestoreWord("");
      await refreshList();
    } catch (e) {
      setHistMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(name: string) {
    if (!window.confirm("Hapus backup ini? File tidak bisa dikembalikan.")) return;
    setBusy("del:" + name);
    try {
      await api(`/api/admin/backup/snapshots/${encodeURIComponent(name)}`, { method: "DELETE" });
      setSnaps((s) => s.filter((x) => x.name !== name));
    } catch (e) {
      setHistMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const replaceOk = mode !== "replace" || confirm.trim().toUpperCase() === CONFIRM_REPLACE;
  const noChange = plan && !plan.places.new && !plan.places.updated && !plan.places.removed && !plan.speeds.new && !plan.speeds.removed;

  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      {/* EKSPOR */}
      <section className={`${card} space-y-4`} aria-labelledby="h-export">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-caramel-100 text-espresso-600">
            <Icon name="download" size={20} />
          </span>
          <div>
            <h2 id="h-export" className="font-extrabold">Ekspor data</h2>
            <p className="text-sm text-ink-500">{countText(now)}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href="/api/admin/backup/export" className={btnPrimary} download>
            <Icon name="download" size={18} /> Unduh backup (.json)
          </a>
          <a href="/api/admin/backup/export?format=csv" className={btnGhost} download>
            <Icon name="list" size={18} /> Daftar tempat (.csv)
          </a>
        </div>
        <p className="flex gap-2 rounded-[14px] bg-amber-100 px-3 py-2.5 text-xs text-espresso-700">
          <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
          <span>File berisi <b>password WiFi</b>. Simpan di tempat aman, jangan dibagikan. JSON untuk dipulihkan; CSV hanya untuk dibuka di Excel/Sheets.</span>
        </p>
      </section>

      {/* IMPOR */}
      <section className={`${card} space-y-4 lg:row-span-2`} aria-labelledby="h-import">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-cream-100 text-espresso-600">
            <Icon name="upload" size={20} />
          </span>
          <div>
            <h2 id="h-import" className="font-extrabold">Impor dari file</h2>
            <p className="text-sm text-ink-500">Cek dulu perubahannya sebelum diterapkan.</p>
          </div>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] border-2 border-dashed p-4 text-center transition ${drag ? "border-espresso-600 bg-cream-100" : "border-line bg-cream-50 hover:border-espresso-400"}`}
        >
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          <Icon name="folder" size={22} className="text-espresso-600" />
          {file ? (
            <>
              <span className="max-w-full truncate text-sm font-bold">{file.name}</span>
              <span className="text-xs text-ink-500">{fmtSize(file.size)} · ketuk untuk ganti file</span>
            </>
          ) : (
            <>
              <span className="text-sm font-bold">Pilih file backup .json</span>
              <span className="text-xs text-ink-500">atau seret ke sini · maks. {fmtSize(maxBytes)}</span>
            </>
          )}
        </label>

        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Cara impor</legend>
          {(
            [
              ["merge", "Gabungkan", "Tambah tempat baru & perbarui yang sama (cocok berdasarkan ID/slug). Data lain tetap."],
              ["replace", "Ganti semua", "Hapus semua data sekarang, lalu isi persis seperti file."],
            ] as const
          ).map(([k, t, d]) => (
            <label key={k} className={`flex cursor-pointer gap-3 rounded-[14px] border p-3 ${mode === k ? (k === "replace" ? "border-slow-600 bg-slow-100/50" : "border-espresso-600 bg-cream-100") : "border-line"}`}>
              <input type="radio" name="mode" value={k} checked={mode === k} onChange={() => changeMode(k)} className="mt-1 accent-espresso-600" />
              <span>
                <span className="block text-sm font-bold">{t}</span>
                <span className="block text-xs text-ink-500">{d}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {busy === "preview" && <Notice msg={{ tone: "info", text: "Memeriksa file…" }} />}
        <Notice msg={importMsg} />
        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-[14px] bg-amber-100 px-3 py-2.5 text-xs text-espresso-700">
            {warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}

        {plan && (
          <div className="space-y-4 rounded-[14px] border border-line p-3">
            <p className="text-sm font-bold">Pratinjau perubahan</p>
            <PlanTable plan={plan} />
            {mode === "replace" && <ConfirmWord id="confirm-replace" word={CONFIRM_REPLACE} value={confirm} onChange={setConfirm} />}
            <button onClick={apply} disabled={!!busy || !replaceOk || !!noChange} className={mode === "replace" ? `${btnDanger} w-full` : `${btnPrimary} w-full`}>
              {busy === "import" ? "Menerapkan…" : noChange ? "Tidak ada perubahan" : mode === "replace" ? "Ganti semua data" : "Terapkan impor"}
            </button>
            <p className="text-xs text-ink-500">Sebelum menulis, data sekarang otomatis disimpan sebagai snapshot sehingga bisa dibatalkan.</p>
          </div>
        )}
      </section>

      {/* RIWAYAT */}
      <section className={`${card} space-y-4`} aria-labelledby="h-hist">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-mint-100 text-mint-600">
              <Icon name="database" size={20} />
            </span>
            <div>
              <h2 id="h-hist" className="font-extrabold">Riwayat backup</h2>
              <p className="text-sm text-ink-500">Snapshot otomatis disimpan {keepAuto} terakhir.</p>
            </div>
          </div>
          <button onClick={snapshotNow} disabled={!!busy} className={`${btnGhost} w-full sm:w-auto`}>
            <Icon name="plus" size={18} /> {busy === "snap" ? "Menyimpan…" : "Buat backup sekarang"}
          </button>
        </div>
        <Notice msg={histMsg} />
        {snaps.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line p-4 text-center text-sm text-ink-500">Belum ada backup tersimpan.</p>
        ) : (
          <ul className="divide-y divide-line">
            {snaps.map((s) => (
              <li key={s.name} className="space-y-2 py-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${s.kind === "auto" ? "bg-cream-100 text-espresso-600" : "bg-mint-100 text-mint-600"}`}>{s.kind === "auto" ? "Otomatis" : "Manual"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{fmtWib(s.createdAt)}</p>
                    <p className="text-xs text-ink-500">
                      {LABELS[s.label] ? `${LABELS[s.label]} · ` : ""}
                      {countText(s.counts)} · {fmtSize(s.size)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-0 sm:pl-[76px]">
                  <a href={`/api/admin/backup/snapshots/${encodeURIComponent(s.name)}`} download className={btnSm}>
                    <Icon name="download" size={16} /> Unduh
                  </a>
                  <button
                    onClick={() => {
                      setRestoring(restoring === s.name ? null : s.name);
                      setRestoreWord("");
                    }}
                    className={btnSm}
                    aria-expanded={restoring === s.name}
                  >
                    <Icon name="refresh" size={16} /> Pulihkan
                  </button>
                  <button onClick={() => remove(s.name)} disabled={busy === "del:" + s.name} className="grid size-10 shrink-0 place-items-center rounded-[14px] border border-line bg-white text-slow-600 hover:border-slow-600 disabled:opacity-50" aria-label="Hapus backup">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
                {restoring === s.name && (
                  <div className="space-y-3 rounded-[14px] border border-slow-600/40 bg-slow-100/40 p-3">
                    <p className="text-sm">
                      Semua data sekarang (<b>{countText(now)}</b>) akan diganti dengan isi snapshot ini. Kondisi sekarang otomatis disimpan dulu.
                    </p>
                    <ConfirmWord id={`restore-${s.name}`} word={CONFIRM_RESTORE} value={restoreWord} onChange={setRestoreWord} />
                    <div className="flex gap-2">
                      <button onClick={() => setRestoring(null)} className={`${btnGhost} flex-1`}>
                        Batal
                      </button>
                      <button onClick={() => restore(s.name)} disabled={!!busy || restoreWord.trim().toUpperCase() !== CONFIRM_RESTORE} className={`${btnDanger} flex-1`}>
                        {busy === "restore" ? "Memulihkan…" : "Pulihkan"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
