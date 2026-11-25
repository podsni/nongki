import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import sharp from "sharp";
import type { PlaceView, SpeedResult } from "./types";
import { fmtMbps, openStatus, photoSize } from "./util";
import { computeStats } from "./wifistats";
import { OG_SIZE, SITE_URL, STORY_SIZE, hostOf } from "./site";

const C = {
  esp900: "#2b1a12",
  esp700: "#4a2c1d",
  esp600: "#6b3f26",
  caramel: "#c8864b",
  caramel100: "#f7e4d0",
  cream50: "#fbf7f2",
  cream100: "#f4eadf",
  cream200: "#eadccb",
  mint: "#0f9d7a",
  mint100: "#d6f2e9",
  amber: "#e9952b",
  slow: "#d14343",
  star: "#f5b301",
  ink: "#1e1814",
  ink500: "#7a6e66",
};

let fontsP: Promise<{ name: string; data: Buffer; weight: 500 | 700 | 800; style: "normal" }[]> | null = null;
function fonts() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  fontsP ??= Promise.all([
    readFile(path.join(dir, "Jakarta-500.ttf")).then((data) => ({ name: "Jakarta", data, weight: 500 as const, style: "normal" as const })),
    readFile(path.join(dir, "Jakarta-700.ttf")).then((data) => ({ name: "Jakarta", data, weight: 700 as const, style: "normal" as const })),
    readFile(path.join(dir, "Jakarta-800.ttf")).then((data) => ({ name: "Jakarta", data, weight: 800 as const, style: "normal" as const })),
    readFile(path.join(dir, "Fraunces-700.ttf")).then((data) => ({ name: "Fraunces", data, weight: 700 as const, style: "normal" as const })),
  ]);
  return fontsP;
}

/** Ambil foto (Google) → JPEG ter-crop sebagai data URL. null bila gagal. */
async function photoData(url: string | undefined, w: number, h: number): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(photoSize(url, w, h), { signal: AbortSignal.timeout(5000), headers: { "user-agent": "Mozilla/5.0 NongkiOG" } });
    if (!r.ok) return null;
    const buf = await sharp(Buffer.from(await r.arrayBuffer())).resize(w, h, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const MARK = (size: number) => (
  <svg width={size} height={size} viewBox="0 0 512 512">
    <rect width="512" height="512" rx="116" fill={C.esp900} />
    <g transform="translate(18 -10)" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M196.4 196.4A56 56 0 0 1 275.6 196.4" stroke={C.caramel} strokeWidth="30" />
      <path d="M162.5 162.5A104 104 0 0 1 309.5 162.5" stroke={C.caramel} strokeWidth="30" />
      <path d="M128.5 128.5A152 152 0 0 1 343.5 128.5" stroke={C.caramel} strokeWidth="30" />
      <path d="M132 256H340V316C340 376 296 420 236 420C176 420 132 376 132 316Z" fill={C.cream50} />
      <path d="M340 276H360C384 276 400 292 400 316C400 340 384 356 360 356H338" stroke={C.cream50} strokeWidth="26" />
      <rect x="112" y="440" width="268" height="22" rx="11" fill={C.cream200} />
    </g>
  </svg>
);

const Brand = ({ size = 56, light = true }: { size?: number; light?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
    {MARK(size)}
    <span style={{ fontFamily: "Fraunces", fontSize: size * 0.72, color: light ? C.cream50 : C.esp900 }}>Nongki</span>
  </div>
);

const Star = ({ s }: { s: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={C.star} />
  </svg>
);
const Wifi = ({ s, c }: { s: number; c: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <path d="M12 20h.01" />
  </svg>
);
const Cup = ({ s, c }: { s: number; c: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2v2" />
    <path d="M14 2v2" />
    <path d="M6 2v2" />
    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
  </svg>
);
const Pin = ({ s, c }: { s: number; c: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const levelColor = (mbps: number | null) => (mbps == null ? C.ink500 : mbps >= 30 ? C.mint : mbps >= 10 ? C.amber : C.slow);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

async function encode(img: ImageResponse, fmt: "jpeg" | "png") {
  // Isi gambar bergantung pada domain → URL gambar membawa ?h=<domain> agar cache CDN terpisah per domain.
  const raw = Buffer.from(await img.arrayBuffer());
  const out = fmt === "jpeg" ? await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer() : await sharp(raw).png({ palette: true, quality: 90, effort: 8, compressionLevel: 9 }).toBuffer();
  return new Response(new Uint8Array(out), {
    headers: {
      "content-type": fmt === "jpeg" ? "image/jpeg" : "image/png",
      "content-length": String(out.length),
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

/* -------------------------------------------------- helper layout (anti kepotong) */

/** Perkiraan bungkus kata: berapa baris untuk lebar `width` pada ukuran `size`. */
function wrapLines(text: string, size: number, width: number, charW: number) {
  const max = Math.max(1, Math.floor(width / (size * charW)));
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.length > max ? w.slice(0, max - 1) + "…" : w;
    }
  }
  if (cur) lines.push(cur);
  return { lines, max };
}

/** Pilih ukuran huruf terbesar agar teks muat ≤ maxLines; jika tetap tidak muat, potong dengan "…". */
function fitText(text: string, width: number, sizes: number[], maxLines: number, charW = 0.56) {
  for (const size of sizes) {
    const { lines } = wrapLines(text, size, width, charW);
    if (lines.length <= maxLines) return { size, text };
  }
  const size = sizes[sizes.length - 1];
  const { lines, max } = wrapLines(text, size, width, charW);
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = (last.length >= max ? last.slice(0, max - 1) : last).replace(/[\s,.·-]+$/, "") + "…";
  return { size, text: kept.join(" ") };
}

/** "Rp 1–25.000" → "Rp1–25rb"; angka → "Rp15rb". */
function shortRp(n: number) {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (n >= 1000) return `Rp${(n / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
  return `Rp${n}`;
}
function shortPriceText(t: string) {
  const nums = (t.match(/\d[\d.]*/g) || []).map((x) => Number(x.replace(/\./g, ""))).filter((x) => isFinite(x));
  if (!nums.length) return t ? clip(t, 12) : "";
  if (nums.length === 1) return shortRp(nums[0]);
  const [a, b] = nums;
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb` : String(n));
  return b >= 1000 && a < 1000 ? `Rp${a}–${k(b)}` : `Rp${k(a)}–${k(b)}`;
}
const mb = (n: number) => fmtMbps(n, n >= 100 ? 0 : 1);
const valueSize = (v: string, big: number) => (v.length <= 7 ? big : v.length <= 9 ? big - 6 : v.length <= 11 ? big - 12 : big - 18);

type Tile = { label: string; value: string; sub: string; color: string; muted?: boolean };

/** Tiga kotak statistik yang sama untuk story, square & OG. Selalu terisi (data kosong → teks netral). */
function placeTiles(p: PlaceView, speeds: SpeedResult[]): Tile[] {
  const st = computeStats(speeds);
  const status = openStatus(p);
  const price: Tile = p.americano
    ? { label: "Americano", value: shortRp(p.americano.price), sub: p.americano.note || "per gelas", color: C.caramel }
    : p.priceText
      ? { label: "Harga", value: shortPriceText(p.priceText), sub: "per orang", color: C.caramel }
      : { label: "Harga", value: "—", sub: "belum ada data", color: C.caramel, muted: true };
  const down: Tile = st
    ? st.down[0] === st.down[1] || st.tests < 2
      ? { label: "Download", value: `${mb(st.down[1])} Mbps`, sub: `${st.tests} tes`, color: levelColor(p.avgDown) }
      : { label: "Download", value: `${mb(st.down[0])}–${mb(st.down[1])}`, sub: `Mbps · ${st.tests} tes`, color: levelColor(p.avgDown) }
    : { label: "WiFi", value: p.wifi.length ? `${p.wifi.length} jaringan` : "Belum dites", sub: "cek speed di Nongki", color: C.mint, muted: !p.wifi.length };
  const third: Tile = st
    ? { label: "Upload · Ping", value: `${mb(p.avgUp ?? st.up[1])} Mbps`, sub: `ping ${fmtMbps(p.avgPing ?? st.ping[0], 0)} ms`, color: C.mint }
    : { label: "Jam buka", value: p.is24h ? "24 jam" : status?.open ? "Buka" : status ? "Tutup" : "—", sub: p.is24h ? "setiap hari" : clip(status?.label.replace(/^(Buka|Tutup) · /, "") || "lihat jadwal", 20), color: C.mint, muted: !status && !p.is24h };
  return [price, down, third];
}

function Tiles({ tiles, width, height, big, gap = 18 }: { tiles: Tile[]; width: number; height: number; big: number; gap?: number }) {
  const w = Math.floor((width - gap * (tiles.length - 1)) / tiles.length);
  const inner = w - 44; // padding kiri-kanan 22px
  // Ukuran huruf menyesuaikan lebar kotak supaya tidak pernah terpotong.
  const fit = (text: string, max: number, charW: number) => Math.max(12, Math.min(max, Math.floor(inner / (Math.max(1, text.length) * charW))));
  const labelSize = Math.min(...tiles.map((t) => fit(t.label, Math.round(big * 0.5), 0.78)));
  const valSize = Math.min(...tiles.map((t) => fit(t.value, valueSize(t.value, big), 0.6)));
  const subSize = Math.min(...tiles.map((t) => fit(clip(t.sub, 20), Math.round(big * 0.46), 0.56)));
  return (
    <div style={{ display: "flex", gap, width, height }}>
      {tiles.map((t, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: w, height, padding: "0 22px", gap: Math.round(big * 0.12), borderRadius: 28, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.10)", overflow: "hidden" }}>
          <div style={{ display: "flex", fontSize: labelSize, fontWeight: 700, color: t.color, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{t.label}</div>
          <div style={{ display: "flex", fontSize: valSize, fontWeight: 800, color: t.muted ? C.cream200 : C.cream50, whiteSpace: "nowrap" }}>{t.value}</div>
          <div style={{ display: "flex", fontSize: subSize, color: C.cream200, whiteSpace: "nowrap" }}>{clip(t.sub, 20)}</div>
        </div>
      ))}
    </div>
  );
}

const RatingPill = ({ p, size }: { p: PlaceView; size: number }) =>
  p.rating == null ? null : (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: size * 1.9, padding: `0 ${size * 0.65}px`, borderRadius: 999, background: C.cream50, color: C.ink, fontSize: size, fontWeight: 800, whiteSpace: "nowrap" }}>
      <Star s={size} /> {p.rating.toLocaleString("id-ID")}
      {p.reviews != null && <span style={{ fontWeight: 500, color: C.ink500, fontSize: size * 0.88 }}>({p.reviews.toLocaleString("id-ID")} ulasan)</span>}
    </div>
  );

const StatusPill = ({ p, size }: { p: PlaceView; size: number }) => {
  const s = openStatus(p);
  if (!s) return null;
  return <div style={{ display: "flex", alignItems: "center", height: size * 1.9, padding: `0 ${size * 0.65}px`, borderRadius: 999, background: s.open ? C.mint100 : "#fae1e1", color: s.open ? C.mint : C.slow, fontSize: size * 0.9, fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</div>;
};

/* ---------------------------------------------------------------- OG: tempat */

export async function placeOg(p: PlaceView, base = SITE_URL, speeds: SpeedResult[] = []) {
  const photo = await photoData(p.photos[0] || p.photoUrl, 520, 630);
  const name = fitText(p.name, 560, [60, 54, 48, 42], 2);
  const tiles = placeTiles(p, speeds);
  const img = new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: C.esp900, fontFamily: "Jakarta", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 520, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${C.esp600}, ${C.esp900})` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={520} height={630} style={{ objectFit: "cover" }} alt="" />
          ) : (
            MARK(200)
          )}
          <div style={{ position: "absolute", top: 0, right: 0, width: 140, height: 630, display: "flex", background: `linear-gradient(90deg, rgba(43,26,18,0), ${C.esp900})` }} />
        </div>
        <div style={{ position: "absolute", left: 540, top: 44, display: "flex" }}>
          <Brand size={46} />
        </div>
        <div style={{ position: "absolute", left: 560, top: 132, width: 600, height: 44, display: "flex", gap: 12 }}>
          <RatingPill p={p} size={22} />
          <StatusPill p={p} size={22} />
        </div>
        <div style={{ position: "absolute", left: 560, top: 198, width: 600, height: 150, display: "flex", alignItems: "center", fontFamily: "Fraunces", fontSize: name.size, lineHeight: 1.06, color: C.cream50, overflow: "hidden" }}>{name.text}</div>
        {p.area && (
          <div style={{ position: "absolute", left: 560, top: 360, width: 600, height: 34, display: "flex", alignItems: "center", gap: 10, fontSize: 24, color: C.cream200, whiteSpace: "nowrap", overflow: "hidden" }}>
            <Pin s={24} c={C.caramel} />
            <span style={{ paddingLeft: 4 }}>{clip(p.area, 40)}</span>
          </div>
        )}
        <div style={{ position: "absolute", left: 560, top: 414, display: "flex" }}>
          <Tiles tiles={tiles} width={600} height={128} big={40} gap={12} />
        </div>
        <div style={{ position: "absolute", left: 560, top: 566, width: 600, display: "flex", fontSize: 22, color: C.caramel, fontWeight: 700, whiteSpace: "nowrap" }}>{hostOf(base)}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
  return encode(img, "jpeg");
}

/* ------------------------------------------------------------ OG: halaman umum */

export async function siteOg(places: PlaceView[], variant: "home" | "jelajah") {
  const withPhoto = places.filter((p) => p.photoUrl).slice(0, 3);
  const photos = await Promise.all(withPhoto.map((p) => photoData(p.photoUrl, 300, 520)));
  const tested = places.filter((p) => p.avgDown != null).length;
  const title = variant === "home" ? "Mau ngopi di mana hari ini?" : "Jelajah tempat ngopi & nongkrong";
  const sub = variant === "home" ? "Lengkap dengan kecepatan WiFi-nya." : "Urutkan dari WiFi tercepat, Americano termurah, atau yang terdekat.";
  const img = new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.esp900, fontFamily: "Jakarta", position: "relative" }}>
        <div style={{ position: "absolute", top: -120, left: 380, width: 420, height: 420, borderRadius: 999, background: "rgba(255,255,255,0.04)", display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640, padding: "52px 40px 48px 60px" }}>
          <Brand size={58} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 58, lineHeight: 1.08, color: C.cream50 }}>{title}</div>
            <div style={{ display: "flex", fontSize: 28, lineHeight: 1.3, color: C.caramel, fontWeight: 700 }}>{sub}</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { t: `${places.length} tempat`, i: <Pin s={24} c={C.caramel} /> },
              { t: tested ? `${tested} WiFi teruji` : "Cek speed WiFi", i: <Wifi s={24} c={C.mint} /> },
              { t: "Harga kopi", i: <Cup s={24} c={C.caramel} /> },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: C.cream50, fontSize: 21, fontWeight: 700, whiteSpace: "nowrap" }}>
                {x.i}
                {x.t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, gap: 14, padding: "40px 40px 40px 0", alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", width: 160, height: i === 1 ? 540 : 470, borderRadius: 28, overflow: "hidden", background: `linear-gradient(160deg, ${[C.esp600, C.caramel, C.esp700][i]}, ${C.esp900})`, alignItems: "center", justifyContent: "center" }}>
              {photos[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos[i]!} width={160} height={i === 1 ? 540 : 470} style={{ objectFit: "cover" }} alt="" />
              ) : (
                MARK(110)
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
  return encode(img, "jpeg");
}

/* ------------------------------------------------------- Story 1080×1920 (IG/WA) */

function qrDataUrl(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="${C.esp900}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function linkParts(base: string, slug: string, maxPath: number) {
  const path = `/tempat/${slug}`;
  return { host: hostOf(base), path: path.length > maxPath ? path.slice(0, maxPath - 1) + "…" : path, url: `${base}${path}` };
}

/**
 * Story 1080×1920. Semua info penting ada di zona aman y≈250–1600
 * (atas ±14% tertutup progress bar/profil IG, bawah ±20% tertutup kolom balas/stiker).
 * Setiap blok diposisikan absolut dengan tinggi tetap → tidak ada yang saling menimpa.
 */
export async function placeStory(p: PlaceView, speeds: SpeedResult[], base = SITE_URL) {
  const W = 1080, H = 1920, X = 64, CW = W - X * 2;
  const photo = await photoData(p.photos[0] || p.photoUrl, W, 1120);
  const st = computeStats(speeds);
  const name = fitText(p.name, CW, [104, 92, 80, 70, 62], 2);
  const link = linkParts(base, p.slug, 30);
  const img = new ImageResponse(
    (
      <div style={{ display: "flex", width: W, height: H, background: C.esp900, fontFamily: "Jakarta", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 1120, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${C.esp600}, ${C.esp900})` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={W} height={1120} style={{ objectFit: "cover" }} alt="" />
          ) : (
            MARK(340)
          )}
        </div>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 360, display: "flex", background: "linear-gradient(180deg, rgba(43,26,18,0.55), rgba(43,26,18,0))" }} />
        <div style={{ position: "absolute", left: 0, top: 420, width: W, height: 700, display: "flex", background: `linear-gradient(180deg, rgba(43,26,18,0) 0%, rgba(43,26,18,0.78) 45%, ${C.esp900} 100%)` }} />

        {/* y 250–338: brand */}
        <div style={{ position: "absolute", left: X, top: 250, display: "flex", height: 88, alignItems: "center", padding: "0 26px 0 14px", borderRadius: 999, background: "rgba(43,26,18,0.72)" }}>
          <Brand size={58} />
        </div>
        {/* y 630–698: rating + status */}
        <div style={{ position: "absolute", left: X, top: 630, width: CW, height: 68, display: "flex", gap: 14, alignItems: "center" }}>
          <RatingPill p={p} size={32} />
          <StatusPill p={p} size={32} />
        </div>
        {/* y 716–936: nama (maks 2 baris, auto-size) */}
        <div style={{ position: "absolute", left: X, top: 716, width: CW, height: 220, display: "flex", alignItems: "center", fontFamily: "Fraunces", fontSize: name.size, lineHeight: 1.04, color: C.cream50, overflow: "hidden" }}>{name.text}</div>
        {/* y 952–1000: area */}
        <div style={{ position: "absolute", left: X, top: 952, width: CW, height: 48, display: "flex", alignItems: "center", gap: 12, fontSize: 34, color: C.cream200, whiteSpace: "nowrap", overflow: "hidden" }}>
          {p.area ? (
            <>
              <Pin s={34} c={C.caramel} />
              <span style={{ paddingLeft: 4 }}>{clip(p.area, 44)}</span>
            </>
          ) : null}
        </div>
        {/* y 1030–1230: statistik (tinggi sama) */}
        <div style={{ position: "absolute", left: X, top: 1030, display: "flex" }}>
          <Tiles tiles={placeTiles(p, speeds)} width={CW} height={200} big={52} />
        </div>
        {/* y 1250–1290: tes terakhir */}
        <div style={{ position: "absolute", left: X, top: 1250, width: CW, height: 40, display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: C.cream200, whiteSpace: "nowrap", overflow: "hidden" }}>
          <Wifi s={28} c={C.mint} />
          {st ? `Tes terakhir ${st.latest.label}${st.loss != null ? ` · loss ${fmtMbps(st.loss, 1)}%` : ""}` : "WiFi belum dites — jadilah yang pertama cek speed"}
        </div>
        {/* y 1316–1586: kartu QR */}
        <div style={{ position: "absolute", left: X, top: 1316, width: CW, height: 270, display: "flex", alignItems: "center", gap: 30, padding: "0 30px", borderRadius: 36, background: C.cream50 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl(link.url)} width={210} height={210} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: CW - 60 - 210 - 30 }}>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: C.esp900, whiteSpace: "nowrap" }}>Cek WiFi, password & harga</div>
            <div style={{ display: "flex", fontSize: 26, color: C.ink500, whiteSpace: "nowrap" }}>Scan QR atau buka</div>
            <div style={{ display: "flex", fontSize: link.host.length > 24 ? 28 : 32, fontWeight: 800, color: C.esp600, whiteSpace: "nowrap" }}>{link.host}</div>
            <div style={{ display: "flex", fontSize: 24, color: C.ink500, whiteSpace: "nowrap" }}>{link.path}</div>
          </div>
        </div>
        {/* dekorasi di zona bawah (boleh tertutup UI story) */}
        <div style={{ position: "absolute", left: 0, top: 1700, width: W, height: 40, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 24, color: C.esp600, fontWeight: 700, letterSpacing: 4 }}>NONGKI · NGOPI SAMBIL CEK WIFI</div>
      </div>
    ),
    { ...STORY_SIZE, fonts: await fonts() },
  );
  return encode(img, "png");
}

/* ----------------------------------------------- Square 1080×1080 (WA status/feed/X) */

export async function placeSquare(p: PlaceView, speeds: SpeedResult[], base = SITE_URL) {
  const W = 1080, X = 56, CW = W - X * 2;
  const photo = await photoData(p.photos[0] || p.photoUrl, W, 600);
  const name = fitText(p.name, CW - 20, [76, 68, 60, 52], 2);
  const link = linkParts(base, p.slug, 40);
  const img = new ImageResponse(
    (
      <div style={{ display: "flex", width: W, height: W, background: C.esp900, fontFamily: "Jakarta", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 600, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${C.esp600}, ${C.esp900})` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={W} height={600} style={{ objectFit: "cover" }} alt="" />
          ) : (
            MARK(260)
          )}
        </div>
        <div style={{ position: "absolute", left: 0, top: 260, width: W, height: 340, display: "flex", background: `linear-gradient(180deg, rgba(43,26,18,0), ${C.esp900})` }} />
        <div style={{ position: "absolute", left: X, top: 44, display: "flex", height: 72, alignItems: "center", padding: "0 22px 0 12px", borderRadius: 999, background: "rgba(43,26,18,0.72)" }}>
          <Brand size={48} />
        </div>
        <div style={{ position: "absolute", right: X, top: 40, display: "flex", padding: 10, borderRadius: 22, background: "#fff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl(link.url)} width={150} height={150} alt="" />
        </div>
        <div style={{ position: "absolute", left: X, top: 452, width: CW, height: 58, display: "flex", gap: 12, alignItems: "center" }}>
          <RatingPill p={p} size={26} />
          <StatusPill p={p} size={26} />
        </div>
        <div style={{ position: "absolute", left: X, top: 522, width: CW, height: 164, display: "flex", alignItems: "center", fontFamily: "Fraunces", fontSize: name.size, lineHeight: 1.04, color: C.cream50, overflow: "hidden" }}>{name.text}</div>
        <div style={{ position: "absolute", left: X, top: 694, width: CW, height: 42, display: "flex", alignItems: "center", gap: 10, fontSize: 28, color: C.cream200, whiteSpace: "nowrap", overflow: "hidden" }}>
          {p.area ? (
            <>
              <Pin s={28} c={C.caramel} />
              <span style={{ paddingLeft: 4 }}>{clip(p.area, 50)}</span>
            </>
          ) : null}
        </div>
        <div style={{ position: "absolute", left: X, top: 760, display: "flex" }}>
          <Tiles tiles={placeTiles(p, speeds)} width={CW} height={170} big={46} gap={16} />
        </div>
        <div style={{ position: "absolute", left: X, top: 962, width: CW, height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 20, padding: "0 24px", background: "rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: C.caramel, whiteSpace: "nowrap" }}>{link.host}</div>
          <div style={{ display: "flex", fontSize: 22, color: C.cream200, whiteSpace: "nowrap" }}>{link.path}</div>
        </div>
      </div>
    ),
    { width: W, height: W, fonts: await fonts() },
  );
  return encode(img, "png");
}
