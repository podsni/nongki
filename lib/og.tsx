import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import sharp from "sharp";
import type { PlaceView, SpeedResult } from "./types";
import { fmtMbps, fmtRp, openStatus, photoSize } from "./util";
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
  // Isi gambar bergantung pada domain (Host) → cache CDN per host.
  const raw = Buffer.from(await img.arrayBuffer());
  const out = fmt === "jpeg" ? await sharp(raw).jpeg({ quality: 82, mozjpeg: true }).toBuffer() : await sharp(raw).png({ palette: true, quality: 90, effort: 8, compressionLevel: 9 }).toBuffer();
  return new Response(new Uint8Array(out), {
    headers: {
      "content-type": fmt === "jpeg" ? "image/jpeg" : "image/png",
      "content-length": String(out.length),
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      vary: "Host",
    },
  });
}

/* ---------------------------------------------------------------- OG: tempat */

export async function placeOg(p: PlaceView, base = SITE_URL) {
  const photo = await photoData(p.photos[0] || p.photoUrl, 600, 630);
  const chips: { icon: React.ReactNode; text: string; bg: string; fg: string }[] = [];
  if (p.rating != null) chips.push({ icon: <Star s={30} />, text: `${p.rating.toLocaleString("id-ID")}${p.reviews != null ? ` (${p.reviews.toLocaleString("id-ID")})` : ""}`, bg: "rgba(255,255,255,0.1)", fg: C.cream50 });
  if (p.americano) chips.push({ icon: <Cup s={28} c={C.esp900} />, text: `Americano ${fmtRp(p.americano.price, true)}`, bg: C.caramel, fg: C.esp900 });
  chips.push(
    p.avgDown != null
      ? { icon: <Wifi s={28} c="#fff" />, text: `WiFi ${fmtMbps(p.avgDown, 0)} Mbps`, bg: levelColor(p.avgDown), fg: "#fff" }
      : { icon: <Wifi s={28} c={C.cream200} />, text: p.wifi.length ? `${p.wifi.length} WiFi` : "WiFi belum dites", bg: "rgba(255,255,255,0.1)", fg: C.cream200 },
  );
  if (p.is24h) chips.push({ icon: null, text: "Buka 24 jam", bg: C.mint100, fg: C.mint });
  const name = clip(p.name, 46);
  const img = new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.esp900, fontFamily: "Jakarta" }}>
        <div style={{ display: "flex", width: 600, height: 630, position: "relative", background: `linear-gradient(135deg, ${C.esp600}, ${C.esp900})` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={600} height={630} style={{ objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>{MARK(220)}</div>
          )}
          <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 630, display: "flex", background: `linear-gradient(90deg, rgba(43,26,18,0), ${C.esp900})` }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "48px 56px 44px 28px", justifyContent: "space-between" }}>
          <Brand size={52} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: name.length > 28 ? 50 : 62, lineHeight: 1.08, color: C.cream50 }}>{name}</div>
            {p.area && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 26, color: C.cream200 }}>
                <Pin s={26} c={C.caramel} /> {clip(p.area, 40)}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              {chips.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 999, background: c.bg, color: c.fg, fontSize: 26, fontWeight: 700 }}>
                  {c.icon}
                  {c.text}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: C.caramel, fontWeight: 700 }}>{hostOf(base)}</div>
        </div>
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

export async function placeStory(p: PlaceView, speeds: SpeedResult[], base = SITE_URL) {
  const W = STORY_SIZE.width;
  const PH = 1040;
  const photo = await photoData(p.photos[0] || p.photoUrl, W, PH);
  const st = computeStats(speeds);
  const status = openStatus(p);
  const url = `${base}/tempat/${p.slug}`;
  const shortUrl = `${hostOf(base)}/tempat/${p.slug}`;
  const r1 = (n: number) => fmtMbps(n, n >= 100 ? 0 : 1);
  const tiles: { label: string; value: string; sub: string; color: string }[] = [
    p.americano
      ? { label: "Americano", value: fmtRp(p.americano.price), sub: p.americano.note || (p.americano.checkedAt ? `dicek ${p.americano.checkedAt}` : "harga menu"), color: C.caramel }
      : { label: "Harga", value: p.priceText || "—", sub: "kisaran per orang", color: C.caramel },
    st
      ? { label: "Download", value: st.down[0] === st.down[1] ? `${r1(st.down[0])} Mbps` : `${r1(st.down[0])}–${r1(st.down[1])}`, sub: st.down[0] === st.down[1] ? `${st.tests} tes` : `Mbps · ${st.tests} tes`, color: levelColor(p.avgDown) }
      : { label: "WiFi", value: p.wifi.length ? `${p.wifi.length} jaringan` : "Belum dites", sub: "cek speed di Nongki", color: C.mint },
    st
      ? { label: "Upload · Ping", value: `${r1(st.up[0] === st.up[1] ? st.up[0] : (st.up[0] + st.up[1]) / 2)} Mbps`, sub: `ping ${fmtMbps(st.ping[0], 0)}${st.ping[0] !== st.ping[1] ? `–${fmtMbps(st.ping[1], 0)}` : ""} ms`, color: C.mint }
      : { label: "Jam buka", value: p.is24h ? "24 jam" : status?.label || "—", sub: p.is24h ? "setiap hari" : "lihat jadwal lengkap", color: C.mint },
  ];
  const name = clip(p.name, 52);
  const img = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.esp900, fontFamily: "Jakarta", position: "relative" }}>
        <div style={{ display: "flex", width: W, height: PH, position: "relative", background: `linear-gradient(160deg, ${C.esp600}, ${C.esp900})`, alignItems: "center", justifyContent: "center" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={W} height={PH} style={{ objectFit: "cover" }} alt="" />
          ) : (
            MARK(360)
          )}
          <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 520, display: "flex", background: `linear-gradient(180deg, rgba(43,26,18,0), ${C.esp900})` }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 360, display: "flex", background: "linear-gradient(180deg, rgba(43,26,18,0.6), rgba(43,26,18,0))" }} />
          <div style={{ position: "absolute", left: 64, top: 230, display: "flex", padding: "14px 26px 14px 16px", borderRadius: 999, background: "rgba(43,26,18,0.72)" }}>
            <Brand size={60} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 64px", marginTop: -260, gap: 22 }}>
          <div style={{ display: "flex", gap: 14 }}>
            {p.rating != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", borderRadius: 999, background: C.cream50, color: C.ink, fontSize: 34, fontWeight: 800 }}>
                <Star s={34} /> {p.rating.toLocaleString("id-ID")}
                {p.reviews != null && <span style={{ fontWeight: 500, color: C.ink500, fontSize: 30 }}>({p.reviews.toLocaleString("id-ID")} ulasan)</span>}
              </div>
            )}
            {status && (
              <div style={{ display: "flex", alignItems: "center", padding: "12px 22px", borderRadius: 999, background: status.open ? C.mint100 : "#fae1e1", color: status.open ? C.mint : C.slow, fontSize: 30, fontWeight: 700 }}>{status.label}</div>
            )}
          </div>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: name.length > 30 ? 84 : 100, lineHeight: 1.04, color: C.cream50 }}>{name}</div>
          {p.area && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 36, color: C.cream200 }}>
              <Pin s={36} c={C.caramel} /> {clip(p.area, 44)}
            </div>
          )}
          <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
            {tiles.map((t, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6, padding: "26px 24px", borderRadius: 32, background: "rgba(255,255,255,0.07)", border: "2px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: t.color, textTransform: "uppercase", letterSpacing: 2 }}>{t.label}</div>
                <div style={{ display: "flex", fontSize: t.value.length > 11 ? 38 : 46, fontWeight: 800, color: C.cream50 }}>{t.value}</div>
                <div style={{ display: "flex", fontSize: 24, color: C.cream200 }}>{clip(t.sub, 26)}</div>
              </div>
            ))}
          </div>
          {st && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: C.cream200 }}>
              <Wifi s={28} c={C.mint} /> Tes terakhir {st.latest.label}{st.loss != null ? ` · loss ${fmtMbps(st.loss, 1)}%` : ""}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 22, padding: 28, borderRadius: 36, background: C.cream50 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl(url)} width={200} height={200} alt="" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: C.esp900 }}>Cek WiFi, password & harga</div>
              <div style={{ display: "flex", fontSize: 28, color: C.ink500 }}>Scan atau buka:</div>
              <div style={{ display: "flex", fontSize: shortUrl.length > 44 ? 24 : 28, fontWeight: 700, color: C.esp600 }}>{shortUrl}</div>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, bottom: 120, width: W, display: "flex", justifyContent: "center", fontSize: 26, color: C.esp600, fontWeight: 700, letterSpacing: 3 }}>NONGKI · NGOPI SAMBIL CEK WIFI</div>
      </div>
    ),
    { ...STORY_SIZE, fonts: await fonts() },
  );
  return encode(img, "png");
}
