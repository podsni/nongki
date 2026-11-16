import type { HoursRow, MenuPrice, Wifi } from "./types";

export type MenuRow = { id: string; item: string; price: string; note: string; checkedAt: string };

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
  photos: string[];
  mapsUrl: string;
  description: string;
  wifi: Wifi[];
  americano: MenuRow; // item tetap "Americano"
  menu: MenuRow[]; // menu lain (opsional)
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
    facilities: Array.isArray(src.facilities) ? (src.facilities as string[]) : [],
    phone: s(src.phone),
    website: s(src.website),
    photos: Array.isArray(src.photos) ? (src.photos as string[]) : src.photoUrl ? [s(src.photoUrl)] : [],
    mapsUrl: s(src.mapsUrl),
    description: s(src.description),
    wifi: Array.isArray(src.wifi) ? (src.wifi as Wifi[]).map((w) => ({ ...w })) : [],
    ...splitMenu(Array.isArray(src.menu) ? (src.menu as MenuPrice[]) : []),
  };
}

const toRow = (m: MenuPrice): MenuRow => ({ id: m.id, item: m.item, price: String(m.price), note: m.note, checkedAt: m.checkedAt });

function splitMenu(menu: MenuPrice[]) {
  const a = menu.find((m) => /americano/i.test(m.item));
  return {
    americano: a ? toRow(a) : { id: "", item: "Americano", price: "", note: "", checkedAt: "" },
    menu: menu.filter((m) => m !== a).map(toRow),
  };
}

/** Gabungkan kembali Americano + menu lain untuk dikirim ke API (baris tanpa harga diabaikan). */
export function joinMenu(v: Pick<FormValues, "americano" | "menu">) {
  const clean = (r: MenuRow) => ({ ...r, price: r.price.replace(/[^\d]/g, "") });
  return [{ ...v.americano, item: v.americano.item.trim() || "Americano" }, ...v.menu].map(clean).filter((r) => r.price && r.item.trim());
}

