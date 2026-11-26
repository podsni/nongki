// Terapkan menu hasil baca foto (docs/menu-maps/*.json) ke situs lewat API admin, mode GABUNGKAN.
// Pemakaian: NONGKI_URL=https://... NONGKI_PASSWORD=... node scripts/apply-menus.mjs docs/menu-maps/menus-2026-11-26.json [--dry]
// Hanya menambah item menu yang belum ada; WiFi, foto, hasil tes & harga Americano yang sudah ada tidak diubah.
import fs from "fs";
const [file, flag] = process.argv.slice(2);
const base = (process.env.NONGKI_URL || "http://localhost:3000").replace(/\/$/, "");
const pw = process.env.NONGKI_PASSWORD;
if (!file || !pw) throw new Error("Butuh file JSON dan env NONGKI_PASSWORD");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const login = await fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
if (!(await login.json()).ok || !cookie) throw new Error("Login gagal");
const places = (await (await fetch(base + "/api/places")).json()).places;
for (const [slug, info] of Object.entries(data.places)) {
  const p = places.find((x) => x.slug === slug);
  if (!p) { console.log(`${slug}: tempat tidak ditemukan, dilewati`); continue; }
  if (!info.items.length) { console.log(`${slug}: tidak ada item (${info.skipped})`); continue; }
  const items = info.items.map(([category, item, price, note]) => ({ category, item, price, note, checkedAt: "", source: "foto" }));
  if (flag === "--dry") { console.log(`${slug}: akan menambah s.d. ${items.length} item`); continue; }
  const r = await fetch(`${base}/api/admin/places/${p.id}/menu`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ items, mode: "merge" }) });
  const j = await r.json();
  console.log(`${slug}: ${j.ok ? `+${j.added} baru, ${j.skipped} dilewati, total ${j.total}` : "GAGAL " + j.error}`);
}
