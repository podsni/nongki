"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { fmtMbps, levelOf } from "@/lib/util";
import { Icon } from "./Icon";

type PlaceOpt = { id: string; slug: string; name: string; area: string; isExample: boolean; wifi: { id: string; ssid: string }[] };
type Phase = "idle" | "ping" | "download" | "upload" | "done" | "error";
type Server = { key: "cf" | "nongki"; label: string; ping: () => string; down: (b: number) => string; up: string };

const SERVERS: Server[] = [
  { key: "cf", label: "Cloudflare (server terdekat)", ping: () => `https://speed.cloudflare.com/__down?bytes=0&r=${Math.random()}`, down: (b) => `https://speed.cloudflare.com/__down?bytes=${b}&r=${Math.random()}`, up: "https://speed.cloudflare.com/__up" },
  { key: "nongki", label: "Server Nongki (Vercel)", ping: () => `/api/speed/ping?r=${Math.random()}`, down: (b) => `/api/speed/down?bytes=${b}&r=${Math.random()}`, up: "/api/speed/up" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

// gauge scale: piecewise between ticks
const TICKS = [0, 5, 10, 25, 50, 100, 250];
function toFrac(mbps: number) {
  if (mbps <= 0) return 0;
  for (let i = 1; i < TICKS.length; i++) {
    if (mbps <= TICKS[i]) return (i - 1 + (mbps - TICKS[i - 1]) / (TICKS[i] - TICKS[i - 1])) / (TICKS.length - 1);
  }
  return 1;
}

function Gauge({ value, label, sub, dark }: { value: number | null; label: string; sub: string; dark: boolean }) {
  const cx = 150, cy = 150, r = 120, a0 = 150, sweep = 240;
  const pt = (deg: number, rr = r) => [cx + rr * Math.cos((deg * Math.PI) / 180), cy + rr * Math.sin((deg * Math.PI) / 180)];
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from), [x2, y2] = pt(to);
    return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const f = value == null ? 0 : toFrac(value);
  const end = a0 + Math.max(0.001, f) * sweep;
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <svg viewBox="0 0 300 220" className="w-full" role="img" aria-label={`${label} ${value != null ? fmtMbps(value) : ""} Mbps`}>
        <defs>
          <linearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#C8864B" />
            <stop offset="1" stopColor="#2BC59B" />
          </linearGradient>
        </defs>
        <path d={arc(a0, a0 + sweep)} stroke={dark ? "rgba(255,255,255,.14)" : "#E9E1D9"} strokeWidth="16" fill="none" strokeLinecap="round" />
        {value != null && value > 0 && <path d={arc(a0, end)} stroke="url(#gg)" strokeWidth="16" fill="none" strokeLinecap="round" style={{ transition: "d .25s" }} />}
        {TICKS.map((t, i) => {
          const [x, y] = pt(a0 + (sweep * i) / (TICKS.length - 1), 92);
          return (
            <text key={t} x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={dark ? "#EADCCB" : "#7A6E66"}>
              {i === TICKS.length - 1 ? "250+" : t}
            </text>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-[38%] text-center">
        <p className={`text-5xl font-extrabold tracking-tight tabular-nums ${dark ? "text-white" : "text-ink-900"}`}>{value != null ? fmtMbps(value) : "—"}</p>
        <p className={`text-sm font-semibold ${dark ? "text-cream-200" : "text-ink-500"}`}>{label}</p>
        <p className={`mt-1 text-xs font-semibold tracking-wide uppercase ${dark ? "text-caramel-500" : "text-ink-500"}`}>{sub}</p>
      </div>
    </div>
  );
}

export function SpeedTest({ places, initialSlug }: { places: PlaceOpt[]; initialSlug: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [server, setServer] = useState<Server>(SERVERS[0]);
  const [ping, setPing] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [down, setDown] = useState<number | null>(null);
  const [up, setUp] = useState<number | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [placeId, setPlaceId] = useState(places.find((p) => p.slug === initialSlug)?.id ?? "");
  const [wifiId, setWifiId] = useState("");
  const [saved, setSaved] = useState<"" | "saving" | "ok" | string>("");
  const abort = useRef<AbortController | null>(null);
  const place = places.find((p) => p.id === placeId);

  async function measurePing(s: Server) {
    const rtts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const t0 = performance.now();
      const res = await fetch(s.ping(), { cache: "no-store", signal: abort.current?.signal });
      await res.arrayBuffer();
      const dt = performance.now() - t0;
      if (i > 0) rtts.push(dt);
      setProgress(0.12 * ((i + 1) / 12));
    }
    const p = median(rtts);
    const diffs = rtts.slice(1).map((v, i) => Math.abs(v - rtts[i]));
    const j = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
    return { p, j };
  }

  async function measureDown(s: Server, seconds = 8) {
    let bytes = 0;
    const start = performance.now();
    let warmBytes = 0, warmT = 0;
    const stop = start + seconds * 1000;
    const ctrl = new AbortController();
    abort.current?.signal.addEventListener("abort", () => ctrl.abort());
    const worker = async () => {
      while (performance.now() < stop) {
        const res = await fetch(s.down(s.key === "cf" ? 25_000_000 : 10_000_000), { cache: "no-store", signal: ctrl.signal });
        const reader = res.body!.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (performance.now() >= stop) {
            reader.cancel().catch(() => {});
            break;
          }
        }
      }
    };
    const timer = setInterval(() => {
      const now = performance.now();
      if (!warmT && now - start > 1200) {
        warmT = now;
        warmBytes = bytes;
      }
      const t = warmT ? (now - warmT) / 1000 : (now - start) / 1000;
      const b = warmT ? bytes - warmBytes : bytes;
      if (t > 0.2) setLive((b * 8) / t / 1e6);
      setProgress(0.12 + 0.48 * Math.min(1, (now - start) / (seconds * 1000)));
    }, 200);
    const workers = Array.from({ length: 4 }, worker);
    await Promise.race([Promise.allSettled(workers), sleep(seconds * 1000 + 1500)]);
    ctrl.abort();
    clearInterval(timer);
    const end = performance.now();
    const t = warmT ? (end - warmT) / 1000 : (end - start) / 1000;
    const b = warmT ? bytes - warmBytes : bytes;
    if (bytes === 0) throw new Error("Download gagal");
    return (b * 8) / t / 1e6;
  }

  async function measureUp(s: Server, seconds = 7) {
    const chunk = new Uint8Array(s.key === "cf" ? 4_000_000 : 2_000_000);
    for (let i = 0; i < chunk.length; i += 65536) crypto.getRandomValues(chunk.subarray(i, Math.min(i + 65536, chunk.length)));
    const blob = new Blob([chunk]);
    let bytes = 0;
    const start = performance.now();
    const stop = start + seconds * 1000;
    const xhrs = new Set<XMLHttpRequest>();
    const one = () =>
      new Promise<void>((resolve) => {
        const x = new XMLHttpRequest();
        xhrs.add(x);
        let last = 0;
        x.upload.onprogress = (e) => {
          bytes += e.loaded - last;
          last = e.loaded;
        };
        x.onloadend = () => {
          xhrs.delete(x);
          resolve();
        };
        x.open("POST", s.up + (s.up.includes("?") ? "&" : "?") + "r=" + Math.random());
        x.send(blob);
      });
    const worker = async () => {
      while (performance.now() < stop) await one();
    };
    const timer = setInterval(() => {
      const now = performance.now();
      const t = (now - start) / 1000;
      if (t > 0.3) setLive((bytes * 8) / t / 1e6);
      setProgress(0.6 + 0.4 * Math.min(1, (now - start) / (seconds * 1000)));
    }, 200);
    await Promise.race([Promise.allSettled(Array.from({ length: 3 }, worker)), sleep(seconds * 1000 + 1500)]);
    xhrs.forEach((x) => x.abort());
    clearInterval(timer);
    const t = (performance.now() - start) / 1000;
    if (bytes === 0) throw new Error("Upload gagal");
    return (bytes * 8) / t / 1e6;
  }

  async function run() {
    abort.current?.abort();
    abort.current = new AbortController();
    setErr("");
    setSaved("");
    setPing(null);
    setJitter(null);
    setDown(null);
    setUp(null);
    setLive(null);
    setProgress(0);
    try {
      setPhase("ping");
      let s = SERVERS[0];
      let pj;
      try {
        pj = await measurePing(s);
      } catch {
        s = SERVERS[1];
        pj = await measurePing(s);
      }
      setServer(s);
      setPing(pj.p);
      setJitter(pj.j);
      setPhase("download");
      const d = await measureDown(s);
      setDown(d);
      setLive(null);
      setPhase("upload");
      const u = await measureUp(s);
      setUp(u);
      setLive(null);
      setProgress(1);
      setPhase("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setPhase("idle");
        return;
      }
      setErr("Tes gagal: " + ((e as Error).message || "periksa koneksi") + ". Coba lagi.");
      setPhase("error");
    }
  }

  function cancel() {
    abort.current?.abort();
    setPhase("idle");
    setLive(null);
    setProgress(0);
  }

  async function save() {
    if (!placeId || down == null || up == null || ping == null) return;
    setSaved("saving");
    const res = await fetch("/api/speed/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, wifiId: wifiId || null, down, up, ping, jitter, server: server.key === "cf" ? "Cloudflare" : "Nongki" }),
    });
    const j = await res.json();
    setSaved(j.ok ? "ok" : j.error || "Gagal menyimpan");
  }

  const running = phase === "ping" || phase === "download" || phase === "upload";
  const lv = levelOf(down);
  const gaugeVal = phase === "download" || phase === "upload" ? live : phase === "done" ? down : null;
  const gaugeLabel = phase === "upload" ? "Mbps upload" : "Mbps download";
  const sub = { idle: "Siap mengukur", ping: "Mengukur ping…", download: "Mengukur download…", upload: "Mengukur upload…", done: "Selesai", error: "Gagal" }[phase];
  const fits = useMemo(() => {
    if (down == null || up == null || ping == null) return [];
    return [
      { l: "Video call HD", ok: down >= 10 && up >= 3 && ping < 100 },
      { l: "Upload file besar", ok: up >= 20 },
      { l: "Streaming 4K", ok: down >= 25 },
      { l: "Game online", ok: ping < 50 && (jitter ?? 0) < 15 },
      { l: "Browsing & chat", ok: down >= 2 },
    ];
  }, [down, up, ping, jitter]);

  const tile = (icon: string, label: string, val: number | null, unit: string, state: "wait" | "run" | "done", digits = 1) => (
    <div className={`rounded-[14px] p-3 ${state === "run" ? "bg-white/10 ring-[1.5px] ring-caramel-500" : state === "done" ? "bg-white/10" : "bg-white/5"}`}>
      <p className="flex items-center gap-1 text-xs text-cream-200">
        <Icon name={icon} size={13} strokeWidth={2.4} /> {label}
      </p>
      <p className={`text-lg font-bold tabular-nums ${state === "wait" ? "text-white/40" : "text-white"}`}>
        {val != null ? (digits === 0 ? Math.round(val) : fmtMbps(val)) : "—"} <span className="text-xs font-normal text-cream-200">{unit}</span>
      </p>
      <p className={`text-xs ${state === "done" ? "text-[#2BC59B]" : state === "run" ? "text-caramel-500" : "text-white/50"}`}>{state === "done" ? "Selesai" : state === "run" ? "Mengukur…" : "Menunggu"}</p>
    </div>
  );
  const st = (k: "ping" | "download" | "upload"): "wait" | "run" | "done" => {
    const order = ["idle", "ping", "download", "upload", "done"];
    const i = order.indexOf(phase === "error" ? "idle" : phase), j = order.indexOf(k);
    return i === j ? "run" : i > j ? "done" : "wait";
  };

  return (
    <main className="mx-auto max-w-6xl px-0 md:px-6 md:py-8">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 bg-espresso-900 px-4 pt-5 pb-6 text-white md:rounded-[26px] md:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold">Cek Kecepatan</h1>
            <span className="text-xs text-cream-200">{server.label}</span>
          </div>
          <Gauge value={gaugeVal} label={gaugeLabel} sub={sub} dark />
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-caramel-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tile("activity", "Ping", ping, "ms", st("ping"), 0)}
            {tile("activity", "Jitter", jitter, "ms", st("ping"))}
            {tile("arrowdown", "Download", phase === "download" ? live : down, "Mbps", st("download"))}
            {tile("arrowup", "Upload", phase === "upload" ? live : up, "Mbps", st("upload"))}
          </div>
          {err && <p className="rounded-[10px] bg-slow-100 px-3 py-2 text-sm font-semibold text-slow-600">{err}</p>}
          {running ? (
            <button onClick={cancel} className="h-12 w-full rounded-[14px] border-[1.5px] border-white/60 font-semibold text-white">
              Batalkan tes
            </button>
          ) : (
            <button onClick={run} className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-mint-600 font-semibold text-white hover:opacity-90">
              <Icon name={phase === "done" ? "refresh" : "zap"} size={18} /> {phase === "done" || phase === "error" ? "Tes ulang" : "Mulai tes"}
            </button>
          )}
          <p className="text-center text-xs text-cream-200/70">Tes memakai ±50–150 MB kuota. Dekati router agar hasil akurat.</p>
        </section>

        <section className="space-y-4 px-4 pb-6 md:px-0">
          {phase === "done" && down != null ? (
            <div className="space-y-4 rounded-[18px] border border-line bg-white p-4">
              <div className={`flex items-center gap-2 rounded-[14px] px-4 py-3 font-semibold text-white ${lv === "Cepat" ? "bg-mint-600" : lv === "Sedang" ? "bg-amber-500" : "bg-slow-600"}`}>
                <Icon name="zap" size={18} />
                {lv === "Cepat" ? "Cepat — cocok untuk kerja & video call" : lv === "Sedang" ? "Sedang — cukup untuk browsing & streaming HD" : "Lambat — cukup untuk chat & media sosial"}
              </div>
              <div className="flex flex-wrap gap-2">
                {fits.map((f) => (
                  <span key={f.l} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${f.ok ? "bg-mint-100 text-mint-600" : "bg-amber-100 text-amber-500"}`}>
                    <Icon name={f.ok ? "check" : "info"} size={13} strokeWidth={3} /> {f.l}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-[18px] border border-line bg-white p-4 text-sm text-ink-500">
              <p className="font-semibold text-ink-900">Cara kerja</p>
              <p>Ping &amp; jitter diukur dari 12 permintaan kecil, lalu download &amp; upload diukur ±8 detik dengan beberapa koneksi paralel ke server Cloudflare terdekat (otomatis pindah ke server Nongki jika gagal).</p>
              <p className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-full bg-mint-100 px-2.5 py-1 text-xs font-semibold text-mint-600">Cepat ≥ 30 Mbps</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-500">Sedang 10–30</span>
                <span className="rounded-full bg-slow-100 px-2.5 py-1 text-xs font-semibold text-slow-600">Lambat &lt; 10</span>
              </p>
            </div>
          )}

          <div className="space-y-3 rounded-[18px] border border-line bg-white p-4">
            <h2 className="font-bold">Simpan hasil ke tempat</h2>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold">Tempat</span>
              <select value={placeId} onChange={(e) => { setPlaceId(e.target.value); setWifiId(""); setSaved(""); }} className="h-12 w-full rounded-[14px] border border-line bg-white px-3 text-sm">
                <option value="">— Pilih tempat —</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.area ? ` · ${p.area}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {place && place.wifi.length > 0 && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold">Terhubung ke WiFi (opsional)</span>
                <select value={wifiId} onChange={(e) => setWifiId(e.target.value)} className="h-12 w-full rounded-[14px] border border-line bg-white px-3 text-sm">
                  <option value="">Tidak tahu / data seluler</option>
                  {place.wifi.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.ssid}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={save} disabled={phase !== "done" || !placeId || saved === "saving" || saved === "ok"} className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-espresso-600 font-semibold text-white disabled:opacity-40">
              <Icon name="save" size={18} /> {saved === "saving" ? "Menyimpan…" : saved === "ok" ? "Tersimpan" : "Simpan hasil ke tempat ini"}
            </button>
            {phase !== "done" && <p className="text-xs text-ink-500">Selesaikan tes dulu untuk menyimpan hasil.</p>}
            {saved === "ok" && place && (
              <p className="text-sm text-mint-600">
                Hasil disimpan.{" "}
                <Link href={`/tempat/${place.slug}`} className="font-semibold underline">
                  Lihat {place.name}
                </Link>
              </p>
            )}
            {saved && saved !== "ok" && saved !== "saving" && <p className="text-sm text-slow-600">{saved}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
