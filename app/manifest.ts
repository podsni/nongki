import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nongki — Tempat ngopi & cek WiFi",
    short_name: "Nongki",
    description: "Rekomendasi tempat ngopi & nongkrong lengkap dengan kecepatan WiFi, password, dan harga Americano.",
    lang: "id-ID",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7f2",
    theme_color: "#2b1a12",
    categories: ["food", "lifestyle", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Cari terdekat", url: "/jelajah?sort=jarak", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cek speed", url: "/cek-speed", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
