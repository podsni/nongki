"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, CircleMarker, useMap } from "react-leaflet";
import type { PlaceView } from "@/lib/types";

function pinIcon(p: PlaceView, on: boolean) {
  const label = p.rating != null ? p.rating.toLocaleString("id-ID") : "•";
  const bg = on ? "#6b3f26" : "#ffffff";
  const fg = on ? "#ffffff" : "#1e1814";
  const dot = on ? "#ffffff" : "#6b3f26";
  const dotFg = on ? "#6b3f26" : "#ffffff";
  return L.divIcon({
    className: "pin-marker",
    iconSize: [64, 34],
    iconAnchor: [20, 34],
    popupAnchor: [10, -30],
    html: `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:999px;background:${bg};color:${fg};font:600 12px var(--font-jakarta),sans-serif;box-shadow:0 4px 14px rgba(43,26,18,.18);border:1px solid #e9e1d9;white-space:nowrap">
      <span style="display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:${dot};color:${dotFg}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg></span>${label}</div>`,
  });
}

function Fit({ places, me }: { places: PlaceView[]; me: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = places.filter((p) => p.lat != null && p.lng != null).map((p) => [p.lat!, p.lng!]);
    if (me) pts.push([me.lat, me.lng]);
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
  }, [places, me, map]);
  return null;
}

export default function MapView({ places, me, selected, onSelect }: { places: PlaceView[]; me: { lat: number; lng: number } | null; selected: string | null; onSelect: (id: string) => void }) {
  const withLL = places.filter((p) => p.lat != null && p.lng != null);
  return (
    <MapContainer center={[-7.9666, 112.6326]} zoom={13} scrollWheelZoom className="size-full">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Fit places={withLL} me={me} />
      {me && <CircleMarker center={[me.lat, me.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#c8864b", fillOpacity: 1 }} />}
      {withLL.map((p) => (
        <Marker key={p.id} position={[p.lat!, p.lng!]} icon={pinIcon(p, selected === p.id)} eventHandlers={{ click: () => onSelect(p.id) }}>
          <Popup>
            <div className="space-y-1">
              <strong className="block text-sm">{p.name}</strong>
              <span className="block text-xs text-ink-500">{p.area || p.address}</span>
              <Link href={`/tempat/${p.slug}`} className="text-xs font-semibold text-espresso-600">
                Lihat detail →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
