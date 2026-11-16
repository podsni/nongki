import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { DB, Place } from "./types";

const BLOB_PATH = "nongki/db.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "db.json");

function blobEnabled() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function storageMode(): "blob" | "file" {
  return blobEnabled() ? "blob" : "file";
}

const EMPTY = (): DB => ({ version: 2, places: [], speeds: [] });

// Migrasi ringan untuk data lama: pastikan field baru ada.
function normalize(db: DB): DB {
  db.places = (db.places || []).map((p) => {
    const raw = p as Place & { isExample?: boolean };
    delete raw.isExample;
    const photos = Array.isArray(raw.photos) ? raw.photos : raw.photoUrl ? [raw.photoUrl] : [];
    return { ...raw, photos, photoUrl: photos[0] || "", menu: Array.isArray(raw.menu) ? raw.menu : [] };
  });
  db.speeds = (db.speeds || []).map((s) => ({ ...s, by: s.by === "admin" ? "admin" : "pengunjung", loss: typeof s.loss === "number" ? s.loss : null }));
  db.version = 2;
  return db;
}

async function readBlob(): Promise<DB | null> {
  const { get } = await import("@vercel/blob");
  const res = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!res) return null; // belum ada file sama sekali
  if (res.statusCode !== 200 || !res.stream) throw new Error("Gagal membaca database (Blob)");
  const text = await new Response(res.stream).text();
  return JSON.parse(text) as DB;
}

async function writeBlob(db: DB) {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(db), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function loadDB(): Promise<DB> {
  if (blobEnabled()) return normalize((await readBlob()) ?? EMPTY());
  try {
    return normalize(JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")) as DB);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return EMPTY();
    throw e;
  }
}

export async function saveDB(db: DB) {
  if (blobEnabled()) return writeBlob(db);
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(db, null, 2));
}

// Simple serialized read-modify-write within one instance.
let chain: Promise<unknown> = Promise.resolve();
export function mutateDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const db = await loadDB();
    const out = await fn(db);
    await saveDB(db);
    return out;
  });
  chain = run.catch(() => undefined);
  return run;
}
