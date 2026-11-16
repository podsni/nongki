import "server-only";
import { loadDB, mutateDB } from "./db";
import type { Place, PlaceView, SpeedResult, Wifi } from "./types";
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

export async function addSpeed(input: Record<string, unknown>, by: SpeedResult["by"] = "pengunjung"): Promise<SpeedResult> {
  const down = numOrNull(input.down, 0, 10000), up = numOrNull(input.up, 0, 10000);
  const ping = numOrNull(input.ping, 0, 10000), jitter = numOrNull(input.jitter, 0, 10000);
  if (down == null || up == null || ping == null) throw new Error("Hasil tes tidak valid");
  const placeId = str(input.placeId, 60);
  return mutateDB((db) => {
    const place = db.places.find((p) => p.id === placeId);
    if (!place) throw new Error("Tempat tidak ditemukan");
    const wifiId = str(input.wifiId, 40);
    const r: SpeedResult = {
      id: uid("s"),
      placeId,
      wifiId: place.wifi.some((w) => w.id === wifiId) ? wifiId : null,
      down: Math.round(down * 10) / 10,
      up: Math.round(up * 10) / 10,
      ping: Math.round(ping),
      jitter: Math.round((jitter ?? 0) * 10) / 10,
      server: str(input.server, 40) || "Cloudflare",
      by,
      createdAt: new Date().toISOString(),
    };
    db.speeds.push(r);
    // keep at most 200 results per place
    const mine = db.speeds.filter((s) => s.placeId === placeId);
    if (mine.length > 200) {
      const drop = new Set(mine.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, mine.length - 200).map((s) => s.id));
      db.speeds = db.speeds.filter((s) => !drop.has(s.id));
    }
    return r;
  });
}

export async function deleteSpeed(id: string) {
  await mutateDB((db) => {
    db.speeds = db.speeds.filter((s) => s.id !== id);
  });
}
