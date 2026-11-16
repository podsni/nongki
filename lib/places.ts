import "server-only";
import { loadDB, mutateDB } from "./db";
import type { MenuPrice, Place, PlaceView, SpeedResult, Wifi } from "./types";
import { CATEGORIES, FACILITIES } from "./types";
import { slugify, toView, uid } from "./util";

export async function listPlaces(): Promise<PlaceView[]> {
  const db = await loadDB();
  return db.places.map((p) => toView(p, db.speeds)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));
}

export async function getPlace(slugOrId: string): Promise<{ place: PlaceView; speeds: SpeedResult[] } | null> {
  const db = await loadDB();
  const p = db.places.find((x) => x.slug === slugOrId || x.id === slugOrId);
  if (!p) return null;
  const speeds = db.speeds.filter((s) => s.placeId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { place: toView(p, db.speeds), speeds };
}

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOrNull = (v: unknown, min: number, max: number) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return isFinite(n) && n >= min && n <= max ? n : null;
};

export function normalizeInput(body: Record<string, unknown>): Omit<Place, "id" | "slug" | "createdAt" | "updatedAt"> {
  const catKeys = CATEGORIES.map((c) => c.key as string);
  const facKeys = FACILITIES.map((f) => f.key as string);
  const wifiIn = Array.isArray(body.wifi) ? body.wifi : [];
  const wifi: Wifi[] = wifiIn
    .map((w) => w as Record<string, unknown>)
    .filter((w) => str(w.ssid))
    .slice(0, 30)
    .map((w) => ({ id: str(w.id, 40) || uid("w"), ssid: str(w.ssid, 64), password: str(w.password, 128), note: str(w.note, 120) }));
  const menuIn = Array.isArray(body.menu) ? body.menu : [];
  const menu: MenuPrice[] = menuIn
    .map((m) => m as Record<string, unknown>)
    .map((m) => ({ id: str(m.id, 40) || uid("m"), item: str(m.item, 60), price: numOrNull(typeof m.price === "string" ? m.price.replace(/[^\d]/g, "") : m.price, 0, 10_000_000), note: str(m.note, 80), checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(str(m.checkedAt)) ? str(m.checkedAt) : "" }))
    .filter((m): m is MenuPrice => !!m.item && m.price != null)
    .slice(0, 40);
  const hoursIn = Array.isArray(body.hours) ? body.hours : [];
  const hours = hoursIn
    .map((h) => h as Record<string, unknown>)
    .filter((h) => str(h.day))
    .slice(0, 7)
    .map((h) => ({ day: str(h.day, 20), text: str(h.text, 80) }));
  const is24h = !!body.is24h;
  const categories = (Array.isArray(body.categories) ? body.categories : []).filter((c): c is string => typeof c === "string" && catKeys.includes(c));
  if (is24h && !categories.includes("24jam")) categories.push("24jam");
  const photosIn = Array.isArray(body.photos) ? body.photos : [];
  const photos = [...new Set(photosIn.map((x) => str(x, 1000)).filter((u) => /^https:\/\//.test(u)))].slice(0, 60);
  const cover = str(body.photoUrl, 1000);
  if (/^https:\/\//.test(cover) && !photos.includes(cover)) photos.unshift(cover);
  return {
    name: str(body.name, 120),
    address: str(body.address, 300),
    area: str(body.area, 120),
    lat: numOrNull(body.lat, -90, 90),
    lng: numOrNull(body.lng, -180, 180),
    rating: numOrNull(body.rating, 0, 5),
    reviews: numOrNull(body.reviews, 0, 10_000_000),
    priceLevel: numOrNull(body.priceLevel, 1, 4),
    priceText: str(body.priceText, 60),
    hours,
    is24h,
    categories,
    facilities: (Array.isArray(body.facilities) ? body.facilities : []).filter((c): c is string => typeof c === "string" && facKeys.includes(c)),
    phone: str(body.phone, 40),
    website: /^https?:\/\//.test(str(body.website)) ? str(body.website, 300) : "",
    photoUrl: photos[0] || "",
    photos,
    mapsUrl: str(body.mapsUrl, 1000),
    description: str(body.description, 1000),
    wifi,
    menu,
  };
}

export async function createPlace(body: Record<string, unknown>): Promise<Place> {
  const data = normalizeInput(body);
  if (!data.name) throw new Error("Nama tempat wajib diisi");
  return mutateDB((db) => {
    let slug = slugify(data.name);
    let i = 2;
    while (db.places.some((p) => p.slug === slug)) slug = `${slugify(data.name)}-${i++}`;
    const now = new Date().toISOString();
    const place: Place = { ...data, id: uid("p"), slug, createdAt: now, updatedAt: now };
    db.places.push(place);
    return place;
  });
}

export async function updatePlace(id: string, body: Record<string, unknown>): Promise<Place> {
  return mutateDB((db) => {
    const idx = db.places.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Tempat tidak ditemukan");
    const data = normalizeInput(body);
    if (!data.name) throw new Error("Nama tempat wajib diisi");
    const place = { ...db.places[idx], ...data, updatedAt: new Date().toISOString() };
    db.places[idx] = place;
    return place;
  });
}

export async function deletePlace(id: string): Promise<void> {
  await mutateDB((db) => {
    db.places = db.places.filter((p) => p.id !== id);
    db.speeds = db.speeds.filter((s) => s.placeId !== id);
  });
}

function parseSpeed(input: Record<string, unknown>) {
  const down = numOrNull(input.down, 0, 10000), up = numOrNull(input.up, 0, 10000);
  const ping = numOrNull(input.ping, 0, 10000), jitter = numOrNull(input.jitter, 0, 10000);
  const loss = numOrNull(input.loss, 0, 100);
  if (down == null || up == null || ping == null) throw new Error("Hasil tes tidak valid");
  // waktu tes dari browser (untuk sesi multi-tes); hanya diterima jika masuk akal (<= 3 jam lalu)
  const at = typeof input.at === "string" ? Date.parse(input.at) : NaN;
  const now = Date.now();
  const createdAt = new Date(isFinite(at) && at <= now + 60_000 && at >= now - 3 * 3600_000 ? Math.min(at, now) : now).toISOString();
  return { down, up, ping, jitter, loss, createdAt };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Simpan satu atau beberapa hasil tes (satu sesi) ke satu tempat. */
export async function addSpeeds(placeIdIn: unknown, wifiIdIn: unknown, items: Record<string, unknown>[], server: unknown, by: SpeedResult["by"] = "pengunjung"): Promise<SpeedResult[]> {
  if (!items.length || items.length > 10) throw new Error("Jumlah hasil tes tidak valid (1–10)");
  const parsed = items.map(parseSpeed);
  const placeId = str(placeIdIn, 60);
  return mutateDB((db) => {
    const place = db.places.find((p) => p.id === placeId);
    if (!place) throw new Error("Tempat tidak ditemukan");
    const wifiId = str(wifiIdIn, 40);
    const out: SpeedResult[] = parsed.map((x) => ({
      id: uid("s"),
      placeId,
      wifiId: place.wifi.some((w) => w.id === wifiId) ? wifiId : null,
      down: r1(x.down),
      up: r1(x.up),
      ping: r1(x.ping),
      jitter: r1(x.jitter ?? 0),
      loss: x.loss == null ? null : r1(x.loss),
      server: str(server, 40) || "Cloudflare",
      by,
      createdAt: x.createdAt,
    }));
    db.speeds.push(...out);
    // simpan maksimal 300 hasil per tempat
    const mine = db.speeds.filter((s) => s.placeId === placeId);
    if (mine.length > 300) {
      const drop = new Set(mine.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, mine.length - 300).map((s) => s.id));
      db.speeds = db.speeds.filter((s) => !drop.has(s.id));
    }
    return out;
  });
}

/** Body: { placeId, wifiId?, server?, results: [{down,up,ping,jitter,loss,at}] } atau satu hasil langsung. */
export function addSpeedsFromBody(body: Record<string, unknown>, by: SpeedResult["by"]) {
  const items = Array.isArray(body.results) ? (body.results as Record<string, unknown>[]) : [body];
  return addSpeeds(body.placeId, body.wifiId, items, body.server, by);
}

export async function deleteSpeed(id: string) {
  await mutateDB((db) => {
    db.speeds = db.speeds.filter((s) => s.id !== id);
  });
}
