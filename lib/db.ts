import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { DB } from "./types";
import { SEED } from "./seed";

const BLOB_PATH = "nongki/db.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "db.json");

function useBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function storageMode(): "blob" | "file" {
  return useBlob() ? "blob" : "file";
}

async function readBlob(): Promise<DB | null> {
  const { get } = await import("@vercel/blob");
  const res = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
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
  if (useBlob()) {
    const db = await readBlob();
    if (db) return db;
    const seed = structuredClone(SEED);
    await writeBlob(seed);
    return seed;
  }
  try {
    return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")) as DB;
  } catch {
    const seed = structuredClone(SEED);
    await saveDB(seed);
    return seed;
  }
}

export async function saveDB(db: DB) {
  if (useBlob()) return writeBlob(db);
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
