import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { loadDB, mutateDB, normalize, storageMode } from "./db";
import { normalizeInput } from "./places";
import type { DB, Place, SpeedResult } from "./types";
import { americanoOf, slugify, uid } from "./util";

/* Format file backup Nongki:
 * { app: "nongki", schemaVersion: 2, exportedAt, counts: {...}, data: { version, places, speeds } }
 * Berisi password WiFi → hanya dilayani lewat route admin, tidak pernah lewat URL Blob publik. */

export const APP = "nongki";
export const SCHEMA_VERSION = 3; // v3: menu[].category & menu[].source (file v2 tetap bisa diimpor)
export const MAX_BYTES = 4 * 1024 * 1024; // < batas body request Vercel (4,5 MB)
export const KEEP_AUTO = 30;
export const KEEP_MANUAL = 50;
const BLOB_PREFIX = "nongki/backups/";
const LOCAL_DIR = path.join(process.cwd(), ".data", "backups");

export type Counts = { places: number; wifi: number; speeds: number; menu: number };
export type BackupFile = { app: string; schemaVersion: number; exportedAt: string; counts: Counts; data: DB };
export type Mode = "merge" | "replace";
export type Snapshot = { name: string; kind: "auto" | "manual"; label: string; createdAt: string; size: number; counts: Counts };

export function countsOf(db: DB): Counts {
  return {
    places: db.places.length,
    wifi: db.places.reduce((n, p) => n + p.wifi.length, 0),
    speeds: db.speeds.length,
    menu: db.places.reduce((n, p) => n + p.menu.length, 0),
  };
}

/* ------------------------------------------------------------------ waktu WIB */
function wibParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}${p.month}${p.day}`, hm: `${p.hour === "24" ? "00" : p.hour}${p.minute}`, s: p.second };
}
export function backupFileName(d = new Date()) {
  const w = wibParts(d);
  return `nongki-backup-${w.ymd}-${w.hm}.json`;
}

export function toBackup(db: DB): BackupFile {
  return { app: APP, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), counts: countsOf(db), data: db };
}

/* ----------------------------------------------------------------- validasi */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && isFinite(Number(v)) ? Number(v) : NaN);
const iso = (v: unknown, fallback: string) => (typeof v === "string" && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : fallback);

/** Validasi & bersihkan isi file. Melempar Error berbahasa Indonesia bila tidak valid. */
export function parseBackup(input: unknown): { db: DB; warnings: string[]; meta: { exportedAt: string | null; app: string | null } } {
  const warnings: string[] = [];
  if (!isObj(input)) throw new Error("File bukan JSON objek. Pastikan memilih file backup Nongki (.json).");
  let raw: Record<string, unknown> = input;
  let meta = { exportedAt: null as string | null, app: null as string | null };
  if ("data" in input) {
    if (input.app !== APP) throw new Error(`File ini bukan backup Nongki (app: ${JSON.stringify(input.app ?? null)}).`);
    const sv = num(input.schemaVersion);
    if (!isFinite(sv) || sv > SCHEMA_VERSION) throw new Error(`Versi skema backup (${String(input.schemaVersion)}) tidak didukung. Versi yang didukung: ≤ ${SCHEMA_VERSION}.`);
    if (!isObj(input.data)) throw new Error("Bagian \"data\" pada backup tidak valid.");
    raw = input.data;
    meta = { exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : null, app: APP };
  }
  if (!Array.isArray(raw.places)) throw new Error("Data tidak punya daftar \"places\" (tempat).");
  if (raw.speeds !== undefined && !Array.isArray(raw.speeds)) throw new Error("\"speeds\" (hasil tes) harus berupa daftar.");
  if (raw.places.length > 2000) throw new Error("Terlalu banyak tempat dalam file (maks. 2.000).");

  const now = new Date().toISOString();
  const places: Place[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  raw.places.forEach((pIn, i) => {
    if (!isObj(pIn)) throw new Error(`Tempat ke-${i + 1} tidak valid (bukan objek).`);
    const clean = normalizeInput(pIn);
    if (!clean.name) throw new Error(`Tempat ke-${i + 1} tidak punya nama.`);
    let id = typeof pIn.id === "string" && /^[\w-]{1,60}$/.test(pIn.id) ? pIn.id : uid("p");
    if (ids.has(id)) {
      warnings.push(`ID ganda "${id}" pada ${clean.name} — dibuatkan ID baru.`);
      id = uid("p");
    }
    ids.add(id);
    let slug = typeof pIn.slug === "string" && pIn.slug ? slugify(pIn.slug) : slugify(clean.name);
    if (!slug) slug = id;
    if (slugs.has(slug)) {
      let n = 2;
      while (slugs.has(`${slug}-${n}`)) n++;
      warnings.push(`Slug "${slug}" dipakai lebih dari sekali — ${clean.name} memakai "${slug}-${n}".`);
      slug = `${slug}-${n}`;
    }
    slugs.add(slug);
    const createdAt = iso(pIn.createdAt, now);
    places.push({ id, slug, ...clean, createdAt, updatedAt: iso(pIn.updatedAt, createdAt) });
  });

  const speeds: SpeedResult[] = [];
  let orphan = 0, bad = 0;
  const sIds = new Set<string>();
  for (const sIn of (raw.speeds as unknown[] | undefined) ?? []) {
    if (!isObj(sIn)) { bad++; continue; }
    const down = num(sIn.down), up = num(sIn.up), ping = num(sIn.ping);
    if (![down, up, ping].every((x) => isFinite(x) && x >= 0 && x < 100_000)) { bad++; continue; }
    const placeId = typeof sIn.placeId === "string" ? sIn.placeId : "";
    if (!ids.has(placeId)) { orphan++; continue; }
    let id = typeof sIn.id === "string" && /^[\w-]{1,60}$/.test(sIn.id) ? sIn.id : uid("s");
    if (sIds.has(id)) id = uid("s");
    sIds.add(id);
    const jitter = num(sIn.jitter), loss = num(sIn.loss);
    speeds.push({
      id,
      placeId,
      wifiId: typeof sIn.wifiId === "string" ? sIn.wifiId : null,
      down, up, ping,
      jitter: isFinite(jitter) ? jitter : 0,
      loss: isFinite(loss) ? Math.min(100, Math.max(0, loss)) : null,
      server: typeof sIn.server === "string" ? sIn.server.slice(0, 80) : "",
      by: sIn.by === "admin" ? "admin" : "pengunjung",
      createdAt: iso(sIn.createdAt, now),
    });
  }
  if (orphan) warnings.push(`${orphan} hasil tes dilewati karena tempatnya tidak ada di file.`);
  if (bad) warnings.push(`${bad} hasil tes dilewati karena angkanya tidak valid.`);
  return { db: normalize({ version: 2, places, speeds }), warnings, meta };
}

/* -------------------------------------------------------- rencana (preview) */

type Tally = { new: number; updated: number; unchanged: number; removed: number };
export type Plan = { mode: Mode; places: Tally; wifi: Tally; speeds: Tally; menu: Tally; before: Counts; after: Counts; samples: { new: string[]; updated: string[]; removed: string[] } };

const t0 = (): Tally => ({ new: 0, updated: 0, unchanged: 0, removed: 0 });
/** JSON dengan urutan key tetap supaya perbandingan tidak terpengaruh urutan field. */
const stable = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);
const strip = (p: Place) => stable({ ...p, updatedAt: "" });

function matchIndex(current: Place[]) {
  const byId = new Map(current.map((p) => [p.id, p]));
  const bySlug = new Map(current.map((p) => [p.slug, p]));
  return (p: Place) => byId.get(p.id) ?? bySlug.get(p.slug);
}

function tallyList<T extends { id: string }>(a: T[], b: T[], t: Tally, removeMissing: boolean) {
  const old = new Map(a.map((x) => [x.id, stable(x)]));
  for (const x of b) {
    const o = old.get(x.id);
    if (o === undefined) t.new++;
    else if (o === stable(x)) t.unchanged++;
    else t.updated++;
  }
  if (removeMissing) {
    const ids = new Set(b.map((x) => x.id));
    t.removed += a.filter((x) => !ids.has(x.id)).length;
  }
}

/** Hasil penggabungan + statistik (tanpa menulis apa pun). */
export function planImport(current: DB, incoming: DB, mode: Mode): { plan: Plan; result: DB } {
  const plan: Plan = { mode, places: t0(), wifi: t0(), speeds: t0(), menu: t0(), before: countsOf(current), after: countsOf(current), samples: { new: [], updated: [], removed: [] } };
  const find = matchIndex(current.places);
  const resultPlaces: Place[] = mode === "replace" ? [] : current.places.map((p) => ({ ...p }));
  const idMap = new Map<string, string>(); // id di file → id di hasil

  const used = new Set<string>();
  for (const inc0 of incoming.places) {
    let inc = inc0;
    let cur = find(inc);
    if (cur && used.has(cur.id)) {
      cur = undefined; // dua entri file cocok ke tempat yang sama → yang kedua jadi tempat baru
      if (current.places.some((p) => p.id === inc.id)) inc = { ...inc, id: uid("p") };
    }
    if (cur) used.add(cur.id);
    if (!cur) {
      plan.places.new++;
      if (plan.samples.new.length < 8) plan.samples.new.push(inc.name);
      tallyList([], inc.wifi, plan.wifi, false);
      tallyList([], inc.menu, plan.menu, false);
      idMap.set(inc0.id, inc.id);
      resultPlaces.push(inc);
      continue;
    }
    const merged: Place = { ...inc, id: cur.id, createdAt: cur.createdAt };
    idMap.set(inc0.id, cur.id);
    tallyList(cur.wifi, inc.wifi, plan.wifi, true);
    tallyList(cur.menu, inc.menu, plan.menu, true);
    if (strip(merged) === strip({ ...cur })) {
      plan.places.unchanged++;
      merged.updatedAt = cur.updatedAt;
    } else {
      plan.places.updated++;
      if (plan.samples.updated.length < 8) plan.samples.updated.push(inc.name);
    }
    if (mode === "replace") resultPlaces.push(merged);
    else resultPlaces[resultPlaces.findIndex((p) => p.id === cur.id)] = merged;
  }

  if (mode === "replace") {
    const keep = new Set(resultPlaces.map((p) => p.id));
    for (const p of current.places) {
      if (!keep.has(p.id)) {
        plan.places.removed++;
        plan.wifi.removed += p.wifi.length;
        plan.menu.removed += p.menu.length;
        if (plan.samples.removed.length < 8) plan.samples.removed.push(p.name);
      }
    }
  }

  // Slug unik di hasil akhir (mis. tempat baru dengan slug yang sudah dipakai tempat lain).
  const seen = new Set<string>();
  for (const p of resultPlaces) {
    let s = p.slug, n = 2;
    while (seen.has(s)) s = `${p.slug}-${n++}`;
    p.slug = s;
    seen.add(s);
  }

  const incSpeeds = incoming.speeds.map((s) => ({ ...s, placeId: idMap.get(s.placeId) ?? s.placeId }));
  let speeds: SpeedResult[];
  if (mode === "replace") {
    tallyList(current.speeds, incSpeeds, plan.speeds, true);
    speeds = incSpeeds;
  } else {
    tallyList(current.speeds, incSpeeds, plan.speeds, false);
    const byId = new Map(current.speeds.map((s) => [s.id, s]));
    for (const s of incSpeeds) byId.set(s.id, s);
    speeds = [...byId.values()];
  }
  const placeIds = new Set(resultPlaces.map((p) => p.id));
  speeds = speeds.filter((s) => placeIds.has(s.placeId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const result = normalize({ version: 2, places: resultPlaces, speeds });
  plan.after = countsOf(result);
  return { plan, result };
}

/* ----------------------------------------------------------------- snapshot */

const NAME_RE = /^(auto|manual)-(\d{8})-(\d{6})-p(\d+)-w(\d+)-s(\d+)-m(\d+)(?:-([a-z0-9-]{1,40}))?\.json$/;
export const validSnapshotName = (n: string) => NAME_RE.test(n);

function parseName(name: string, size: number): Snapshot | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const [, kind, ymd, hms, p, w, s, mm, label] = m;
  const createdAt = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}+07:00`;
  return { name, kind: kind as Snapshot["kind"], label: label ?? "", createdAt: new Date(createdAt).toISOString(), size, counts: { places: +p, wifi: +w, speeds: +s, menu: +mm } };
}

async function blob() {
  return import("@vercel/blob");
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  if (storageMode() === "blob") {
    const { list } = await blob();
    let cursor: string | undefined;
    do {
      const r = await list({ prefix: BLOB_PREFIX, cursor, limit: 1000 });
      for (const b of r.blobs) {
        const s = parseName(b.pathname.slice(BLOB_PREFIX.length), b.size);
        if (s) out.push(s);
      }
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
  } else {
    try {
      for (const f of await fs.readdir(LOCAL_DIR)) {
        const st = await fs.stat(path.join(LOCAL_DIR, f));
        const s = parseName(f, st.size);
        if (s) out.push(s);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.name.localeCompare(a.name));
}

export async function readSnapshot(name: string): Promise<string> {
  if (!validSnapshotName(name)) throw new Error("Nama backup tidak valid.");
  if (storageMode() === "blob") {
    const { get } = await blob();
    const r = await get(BLOB_PREFIX + name, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) throw new Error("Backup tidak ditemukan.");
    return new Response(r.stream).text();
  }
  try {
    return await fs.readFile(path.join(LOCAL_DIR, name), "utf8");
  } catch {
    throw new Error("Backup tidak ditemukan.");
  }
}

async function removeSnapshots(names: string[]) {
  if (!names.length) return;
  if (storageMode() === "blob") {
    const { del } = await blob();
    await del(names.map((n) => BLOB_PREFIX + n));
  } else await Promise.all(names.map((n) => fs.rm(path.join(LOCAL_DIR, n), { force: true })));
}

export async function deleteSnapshot(name: string) {
  if (!validSnapshotName(name)) throw new Error("Nama backup tidak valid.");
  await removeSnapshots([name]);
}

/** Simpan snapshot (private). label: penanda singkat mis. "sebelum-import". */
export async function createSnapshot(kind: Snapshot["kind"], label = "", db?: DB): Promise<Snapshot> {
  const data = db ?? (await loadDB());
  const c = countsOf(data);
  const w = wibParts();
  const safeLabel = label ? slugify(label).slice(0, 40) : "";
  const name = `${kind}-${w.ymd}-${w.hm}${w.s}-p${c.places}-w${c.wifi}-s${c.speeds}-m${c.menu}${safeLabel ? `-${safeLabel}` : ""}.json`;
  const body = JSON.stringify(toBackup(data));
  if (storageMode() === "blob") {
    const { put } = await blob();
    await put(BLOB_PREFIX + name, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  } else {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, name), body);
  }
  // Rotasi: simpan maks. KEEP_AUTO otomatis & KEEP_MANUAL manual terbaru.
  const all = await listSnapshots();
  const old = [...all.filter((s) => s.kind === "auto").slice(KEEP_AUTO), ...all.filter((s) => s.kind === "manual").slice(KEEP_MANUAL)].map((s) => s.name);
  await removeSnapshots(old.filter((n) => n !== name));
  return parseName(name, Buffer.byteLength(body))!;
}

/* --------------------------------------------------------- terapkan import */

export const CONFIRM_REPLACE = "GANTI";
export const CONFIRM_RESTORE = "PULIHKAN";

/** Terapkan data hasil parse ke database (di dalam kunci tulis), setelah snapshot otomatis. */
export async function applyImport(incoming: DB, mode: Mode, label: string): Promise<{ plan: Plan; snapshot: Snapshot }> {
  let snapshot: Snapshot | null = null;
  const plan = await mutateDB(async (db) => {
    snapshot = await createSnapshot("auto", label, db);
    const { plan, result } = planImport(db, incoming, mode);
    db.places = result.places;
    db.speeds = result.speeds;
    db.version = result.version;
    return plan;
  });
  return { plan, snapshot: snapshot! };
}

/* -------------------------------------------------------------------- CSV */

export function placesCsv(db: DB): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["nama", "slug", "area", "alamat", "lat", "lng", "rating", "ulasan", "kisaran_harga", "americano_rp", "americano_catatan", "buka_24_jam", "jumlah_wifi", "wifi (ssid=password)", "jumlah_tes", "rata_download_mbps", "link_maps", "diubah"];
  const rows = db.places.map((p) => {
    const tests = db.speeds.filter((s) => s.placeId === p.id);
    const avg = tests.length ? tests.reduce((a, s) => a + s.down, 0) / tests.length : null;
    const am = americanoOf(p);
    return [p.name, p.slug, p.area, p.address, p.lat, p.lng, p.rating, p.reviews, p.priceText, am?.price ?? "", am?.note ?? "", p.is24h ? "ya" : "tidak", p.wifi.length, p.wifi.map((w) => `${w.ssid}=${w.password}`).join(" | "), tests.length, avg == null ? "" : avg.toFixed(1), p.mapsUrl, p.updatedAt];
  });
  return "\ufeff" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export async function readJsonBody(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES + 1024) throw new Error(`File terlalu besar (maks. ${MAX_BYTES / 1024 / 1024} MB).`);
  const text = await req.text();
  if (text.length > MAX_BYTES + 1024) throw new Error(`File terlalu besar (maks. ${MAX_BYTES / 1024 / 1024} MB).`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Isi file bukan JSON yang valid.");
  }
}
