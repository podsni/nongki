export type Wifi = {
  id: string;
  ssid: string;
  password: string;
  note: string;
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
  photoUrl: string;
  mapsUrl: string;
  description: string;
  isExample: boolean;
  wifi: Wifi[];
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
  server: string;
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
