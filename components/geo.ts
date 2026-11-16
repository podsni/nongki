"use client";
import { useSyncExternalStore } from "react";

/**
 * Lokasi pengguna untuk fitur "Cari terdekat".
 * Hanya hidup di browser (memori + sessionStorage tab ini) — tidak pernah dikirim/disimpan ke server.
 */
export type Loc = { lat: number; lng: number; acc: number; at: number };
export type GeoStatus = "idle" | "asking" | "ok" | "denied" | "unavailable" | "timeout" | "unsupported" | "insecure";
export type GeoState = { status: GeoStatus; loc: Loc | null; msg: string };

const KEY = "nongki:loc";
const MAX_AGE = 30 * 60_000; // pakai ulang lokasi dari sesi tab ini maks. 30 menit
const SERVER: GeoState = { status: "idle", loc: null, msg: "" };
let state: GeoState = SERVER;
let inited = false;
const subs = new Set<() => void>();

function set(next: Partial<GeoState>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}

export const GEO_MSG: Record<GeoStatus, string> = {
  idle: "",
  asking: "Mencari lokasimu…",
  ok: "",
  denied: "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, lalu coba lagi.",
  unavailable: "Lokasi tidak tersedia. Pastikan GPS/Location Services aktif, lalu coba lagi.",
  timeout: "Mencari lokasi terlalu lama. Coba lagi di tempat dengan sinyal lebih baik.",
  unsupported: "Browser ini tidak mendukung lokasi.",
  insecure: "Lokasi hanya bisa dipakai lewat koneksi aman (https).",
};

function init() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const loc = JSON.parse(raw) as Loc;
      if (Date.now() - loc.at < MAX_AGE && isFinite(loc.lat) && isFinite(loc.lng)) state = { status: "ok", loc, msg: "" };
    }
  } catch {}
  // Jika izin sudah pernah diberikan, ambil lokasi diam-diam (tanpa prompt).
  if (state.status !== "ok" && navigator.permissions?.query) {
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") locate();
      })
      .catch(() => {});
  }
}

function subscribe(f: () => void) {
  init();
  subs.add(f);
  return () => subs.delete(f);
}

export function locate(): Promise<Loc | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    if (!window.isSecureContext) {
      set({ status: "insecure", msg: GEO_MSG.insecure });
      return resolve(null);
    }
    if (!("geolocation" in navigator)) {
      set({ status: "unsupported", msg: GEO_MSG.unsupported });
      return resolve(null);
    }
    set({ status: "asking", msg: GEO_MSG.asking });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: Loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0), at: Date.now() };
        try {
          sessionStorage.setItem(KEY, JSON.stringify(loc));
        } catch {}
        set({ status: "ok", loc, msg: "" });
        resolve(loc);
      },
      (err) => {
        const status: GeoStatus = err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable";
        set({ status, msg: GEO_MSG[status] });
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  });
}

export function forgetLocation() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  set({ status: "idle", loc: null, msg: "" });
}

export const getGeo = () => state;

export function useGeo(): GeoState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

export function fmtKm(km: number): string {
  if (!isFinite(km)) return "";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toLocaleString("id-ID", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}
