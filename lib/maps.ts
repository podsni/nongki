import "server-only";
import type { HoursRow } from "./types";

export type ImportDraft = {
  name: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews: number | null;
  priceLevel: number | null;
  priceText: string;
  hours: HoursRow[];
  is24h: boolean;
  categories: string[];
  googleCategory: string;
  phone: string;
  website: string;
  photoUrl: string;
  mapsUrl: string;
  resolvedUrl: string;
  extracted: string[]; // field yang berhasil diambil
  warnings: string[];
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Cookie: "CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmlkIAEaBgiA_LyaBg",
};

export function isGoogleMapsUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    const h = u.hostname.toLowerCase();
    if (h === "maps.app.goo.gl" || h === "goo.gl") return true;
    if (/^(www\.)?google\.[a-z.]+$/.test(h) && u.pathname.startsWith("/maps")) return true;
    if (/^maps\.google\.[a-z.]+$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

async function resolveRedirects(url: string): Promise<string> {
  let cur = url;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(cur, { redirect: "manual", headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      cur = new URL(loc, cur).toString();
      continue;
    }
    if (res.status === 200 && /goo\.gl/.test(new URL(cur).hostname)) {
      // some short links answer 200 with a meta refresh / JS redirect
      const html = await res.text();
      const m = html.match(/https:\/\/(?:www\.)?(?:maps\.)?google\.[^"'\s<>]+/);
      if (m) {
        cur = m[0].replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
        continue;
      }
    }
    break;
  }
  return cur;
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

function at(x: unknown, ...path: number[]): unknown {
  let cur: unknown = x;
  for (const i of path) {
    if (!Array.isArray(cur)) return undefined;
    cur = cur[i];
  }
  return cur;
}

function parseFromUrl(u: URL) {
  const out: { name?: string; address?: string; lat?: number; lng?: number } = {};
  const q = u.searchParams.get("q") || u.searchParams.get("query");
  if (q && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(q)) {
    const parts = q.split(",").map((s) => s.trim());
    out.name = parts[0];
    if (parts.length > 1) out.address = parts.slice(1).join(", ");
  } else if (q) {
    const [a, b] = q.split(",").map(Number);
    out.lat = a;
    out.lng = b;
  }
  const place = u.pathname.match(/\/maps\/place\/([^/]+)/);
  if (place && !out.name) {
    const parts = decodeURIComponent(place[1].replace(/\+/g, " ")).split(",").map((s) => s.trim());
    out.name = parts[0];
    if (parts.length > 1 && !out.address) out.address = parts.slice(1).join(", ");
  }
  const d34 = u.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const atll = u.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const ll = u.searchParams.get("ll")?.split(",").map(Number);
  if (d34) {
    out.lat = Number(d34[1]);
    out.lng = Number(d34[2]);
  } else if (atll) {
    out.lat = Number(atll[1]);
    out.lng = Number(atll[2]);
  } else if (ll && ll.length === 2 && ll.every(isFinite)) {
    out.lat = ll[0];
    out.lng = ll[1];
  }
  return out;
}

function areaFrom(address: string): string {
  const parts = address.split(",").map((s) => s.trim());
  const kec = parts.find((p) => /^Kec\.?\s/i.test(p))?.replace(/^Kec\.?\s*/i, "");
  const kota = parts.find((p) => /^(Kota|Kabupaten|Kab\.)\s/i.test(p))?.replace(/\s+\d{5}$/, "").replace(/^Kota\s+/i, "");
  return [kec, kota?.split(",")[0]].filter(Boolean).join(", ") || parts.slice(-2).join(", ");
}

function guessCategories(googleCat: string, is24h: boolean, priceLevel: number | null, name: string): string[] {
  const c = new Set<string>();
  const s = (googleCat + " " + name).toLowerCase();
  if (/kopi|kafe|cafe|coffee|warkop|kedai/.test(s)) c.add("kopi");
  if (/cowork|work|ruang kerja/.test(s)) c.add("wfc");
  if (/warkop|nongkrong|bar|lounge|angkringan|kafe|cafe/.test(s)) c.add("nongkrong");
  if (is24h) c.add("24jam");
  if (priceLevel === 1) c.add("murah");
  return [...c];
}

function priceFromText(t: string): number | null {
  const m = t.replace(/\./g, "").match(/Rp\s*(\d+)\s*[–-]\s*(?:Rp\s*)?(\d+)/i);
  if (!m) return null;
  const hi = Number(m[2]);
  if (hi <= 30000) return 1;
  if (hi <= 60000) return 2;
  if (hi <= 120000) return 3;
  return 4;
}

export async function importFromGoogleMaps(rawUrl: string): Promise<ImportDraft> {
  const url = rawUrl.trim();
  if (!isGoogleMapsUrl(url)) throw new Error("Link bukan link Google Maps (maps.app.goo.gl atau google.com/maps).");
  const warnings: string[] = [];
  const extracted = new Set<string>();
  const resolved = await resolveRedirects(url);
  const ru = new URL(resolved);
  const fromUrl = parseFromUrl(ru);

  const draft: ImportDraft = {
    name: fromUrl.name || "",
    address: fromUrl.address || "",
    area: "",
    lat: fromUrl.lat ?? null,
    lng: fromUrl.lng ?? null,
    rating: null,
    reviews: null,
    priceLevel: null,
    priceText: "",
    hours: [],
    is24h: false,
    categories: [],
    googleCategory: "",
    phone: "",
    website: "",
    photoUrl: "",
    mapsUrl: url,
    resolvedUrl: resolved,
    extracted: [],
    warnings,
  };
  if (draft.name) extracted.add("nama");
  if (draft.address) extracted.add("alamat");
  if (draft.lat != null) extracted.add("koordinat");

  // Step 2: fetch the maps page and the internal "preview/place" JSON it references.
  try {
    const ftid = ru.searchParams.get("ftid") || ru.href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1] || null;
    let pageUrl = new URL(ru.toString());
    if (ftid) {
      pageUrl = new URL("https://www.google.com/maps");
      pageUrl.searchParams.set("q", [draft.name, draft.address].filter(Boolean).join(", ") || ftid);
      pageUrl.searchParams.set("ftid", ftid);
    }
    if (/^maps\.google\./.test(pageUrl.hostname)) pageUrl.hostname = "www.google.com";
    if (!pageUrl.pathname.startsWith("/maps")) pageUrl.pathname = "/maps";
    pageUrl.searchParams.set("hl", "id");
    pageUrl.searchParams.set("gl", "id");
    const html = await (await fetch(pageUrl, { headers: HEADERS, signal: AbortSignal.timeout(12000) })).text();
    const cands = html.match(/(?:https:\/\/www\.google\.[a-z.]+)?\/maps\/preview\/place\?[^"'\s<>]+/g) || [];
    const m = cands.filter((c) => /pb=/.test(c)) as string[];
    if (!m.length) {
      warnings.push("Halaman Google Maps tidak memuat data detail (mungkin diblokir). Lengkapi rating/jam secara manual.");
    } else {
      const previewUrl = new URL(m[0].replace(/&amp;/g, "&").replace(/\\u0026/g, "&"), "https://www.google.com");
      const txt = await (await fetch(previewUrl, { headers: { ...HEADERS, Accept: "*/*" }, signal: AbortSignal.timeout(12000) })).text();
      const json = JSON.parse(txt.replace(/^\)\]\}'\s*/, ""));
      const p = at(json, 6) as unknown[];
      if (!Array.isArray(p) || typeof at(p, 11) !== "string") throw new Error("detail tempat tidak ditemukan dari link ini (coba pakai link Bagikan dari aplikasi Google Maps)");

      const name = at(p, 11);
      if (typeof name === "string" && name) { draft.name = name; extracted.add("nama"); }
      const addr = at(p, 39);
      const addrParts = at(p, 2);
      if (typeof addr === "string" && addr) { draft.address = addr; extracted.add("alamat"); }
      else if (Array.isArray(addrParts)) { draft.address = addrParts.filter((x) => typeof x === "string").join(", "); extracted.add("alamat"); }
      const lat = num(at(p, 9, 2)), lng = num(at(p, 9, 3));
      if (lat != null && lng != null) { draft.lat = lat; draft.lng = lng; extracted.add("koordinat"); }
      const rating = num(at(p, 4, 7));
      if (rating != null) { draft.rating = rating; extracted.add("rating"); }
      const reviews = num(at(p, 4, 8));
      if (reviews != null) { draft.reviews = reviews; extracted.add("jumlah ulasan"); }
      const cats = at(p, 13);
      if (Array.isArray(cats) && typeof cats[0] === "string") { draft.googleCategory = cats.join(", "); extracted.add("kategori Google"); }
      const pl = at(p, 4, 2);
      if (typeof pl === "string" && /^\$+$|^Rp/.test(pl)) {
        if (/^\$+$/.test(pl)) draft.priceLevel = Math.min(4, pl.length);
        else draft.priceText = pl;
        extracted.add("harga");
      }
      const hoursRows = at(p, 203, 0);
      if (Array.isArray(hoursRows)) {
        const rows: HoursRow[] = [];
        for (const r of hoursRows) {
          const day = at(r, 0);
          const slots = at(r, 3);
          if (typeof day === "string" && Array.isArray(slots)) {
            const text = slots.map((s) => at(s, 0)).filter((x) => typeof x === "string").join(", ");
            rows.push({ day, text: text || "Tutup" });
          }
        }
        if (rows.length) {
          draft.hours = rows;
          draft.is24h = rows.every((r) => /24 jam|24 hours/i.test(r.text));
          extracted.add("jam buka");
        }
      } else {
        const h34 = at(p, 34, 1);
        if (Array.isArray(h34)) {
          draft.hours = h34.map((r) => ({ day: String(at(r, 0) ?? ""), text: (at(r, 1) as string[] | undefined)?.join(", ") || "" })).filter((r) => r.day);
          if (draft.hours.length) { draft.is24h = draft.hours.every((r) => /24 jam|24 hours/i.test(r.text)); extracted.add("jam buka"); }
        }
      }
      const phone = at(p, 178, 0, 0);
      if (typeof phone === "string") { draft.phone = phone; extracted.add("telepon"); }
      const web = at(p, 7, 0);
      if (typeof web === "string" && /^https?:/.test(web)) { draft.website = web; extracted.add("website"); }
      const photo = at(p, 72, 0, 0, 6, 0);
      if (typeof photo === "string" && photo.startsWith("http")) {
        draft.photoUrl = photo.replace(/=w\d+-h\d+[^&]*$/, "=w1200-h800-k-no");
        extracted.add("foto");
      }
      if (!draft.priceText) {
        const pm = txt.match(/Rp\s?[\d.]+\s?[–-]\s?[\d.]+/);
        if (pm) { draft.priceText = pm[0].replace(/\s+/g, " "); extracted.add("harga"); }
      }
      if (draft.priceLevel == null && draft.priceText) draft.priceLevel = priceFromText(draft.priceText);
    }
  } catch (e) {
    warnings.push("Gagal membaca detail dari Google Maps: " + (e instanceof Error ? e.message : String(e)) + ". Lengkapi manual.");
  }

  if (!draft.name) warnings.push("Nama tidak terbaca — isi manual.");
  if (draft.lat == null) warnings.push("Koordinat tidak terbaca — peta tidak akan menampilkan pin sampai diisi.");
  draft.area = draft.address ? areaFrom(draft.address) : "";
  draft.categories = guessCategories(draft.googleCategory, draft.is24h, draft.priceLevel, draft.name);
  draft.extracted = [...extracted];
  return draft;
}
