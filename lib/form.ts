import type { HoursRow, Wifi } from "./types";

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
  };
}

