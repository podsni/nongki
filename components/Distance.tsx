"use client";
import { haversineKm } from "@/lib/util";
import { fmtKm, useGeo } from "./geo";
import { Icon } from "./Icon";

export function DistanceText({ km }: { km: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-espresso-600" data-testid="distance">
      • <Icon name="nav" size={11} /> {fmtKm(km)}
    </span>
  );
}


/** Badge jarak kecil untuk kartu (null bila lokasi belum diketahui). */
export function AutoDistance({ lat, lng, badge = false }: { lat: number | null; lng: number | null; badge?: boolean }) {
  const g = useGeo();
  if (!g.loc || lat == null || lng == null) return null;
  const km = haversineKm(g.loc, { lat, lng });
  if (badge)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-espresso-600 shadow-sm" data-testid="distance">
        <Icon name="nav" size={12} /> {fmtKm(km)}
      </span>
    );
  return <DistanceText km={km} />;
}
