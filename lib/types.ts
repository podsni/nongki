export type Wifi = {
  id: string;
  ssid: string;
  password: string;
  note: string;
};

/** Harga satu menu, mis. Americano. `checkedAt` = tanggal terakhir dicek (YYYY-MM-DD). */
export type MenuPrice = {
  id: string;
  item: string;
  price: number; // Rupiah
  note: string; // ukuran / varian, mis. "12 oz, panas"
  checkedAt: string;
};

export type HoursRow = { day: string; text: string };

export type Place = {
  id: string;
  slug: string;
  name: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews: number | null;
  priceLevel: number | null; // 1 = murah ... 4 = mahal
  priceText: string;
  hours: HoursRow[];
  is24h: boolean;
  categories: string[];
  facilities: string[];
  phone: string;
  website: string;
  photoUrl: string; // foto sampul (= photos[0])
  photos: string[]; // galeri dari Google Maps / tambahan admin
  mapsUrl: string;
  description: string;
  wifi: Wifi[];
  menu: MenuPrice[]; // harga menu; Americano = item yang namanya mengandung "americano"
  createdAt: string;
  updatedAt: string;
};

export type SpeedResult = {
  id: string;
  placeId: string;
  wifiId: string | null;
  down: number;
  up: number;
  ping: number;
  jitter: number;
  loss: number | null; // % permintaan ping yang gagal/timeout (null untuk data lama)
  server: string;
  by: "admin" | "pengunjung";
  createdAt: string;
};

export type DB = {
  version: number;
  places: Place[];
  speeds: SpeedResult[];
};

export type SpeedLevel = "Cepat" | "Sedang" | "Lambat";

export type PlaceView = Place & {
  avgDown: number | null;
  avgUp: number | null;
  avgPing: number | null;
  speedCount: number;
  level: SpeedLevel | null;
  americano: MenuPrice | null;
};

export const CATEGORIES = [
  { key: "kopi", label: "Kopi", icon: "coffee" },
  { key: "wfc", label: "WFC", icon: "laptop" },
  { key: "nongkrong", label: "Nongkrong", icon: "users" },
  { key: "24jam", label: "24 Jam", icon: "moon" },
  { key: "murah", label: "Murah", icon: "coins" },
] as const;

export const FACILITIES = [
  { key: "wifi", label: "WiFi", icon: "wifi" },
  { key: "colokan", label: "Colokan", icon: "plug" },
  { key: "ac", label: "AC", icon: "snow" },
  { key: "musala", label: "Musala", icon: "mosque" },
  { key: "parkir", label: "Parkir", icon: "parking" },
  { key: "toilet", label: "Toilet", icon: "toilet" },
  { key: "smoking", label: "Smoking area", icon: "cig" },
  { key: "outdoor", label: "Outdoor", icon: "sun" },
  { key: "livemusic", label: "Live music", icon: "music" },
] as const;

export const PRICE_LABEL: Record<number, string> = { 1: "$ · Murah", 2: "$$ · Sedang", 3: "$$$ · Agak mahal", 4: "$$$$ · Mahal" };
