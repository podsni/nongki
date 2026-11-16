"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMbps, levelOf } from "@/lib/util";
import { computeStats } from "@/lib/wifistats";
import type { SpeedResult } from "@/lib/types";
import { Icon } from "./Icon";
import { WifiDetails } from "./WifiDetails";

type PlaceOpt = { id: string; slug: string; name: string; area: string; wifi: { id: string; ssid: string }[] };
type Run = { down: number; up: number; ping: number; jitter: number; loss: number; at: string };
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

/**
 * Tes kecepatan di browser. `admin` = mode tertanam di halaman admin:
 * tempat dikunci, hasil disimpan lewat /api/admin/speeds dan ditandai "diukur admin".
 */
export function SpeedTest({ places, initialSlug, admin = false }: { places: PlaceOpt[]; initialSlug: string; admin?: boolean }) {
  const router = useRouter();
  const saveRef = useRef<HTMLDivElement>(null);
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
  const [loss, setLoss] = useState<number | null>(null);
  const [count, setCount] = useState(admin ? 5 : 1); // jumlah tes per sesi
  const [runs, setRuns] = useState<Run[]>([]);
  const [runNo, setRunNo] = useState(0);
  const runRef = useRef({ i: 0, n: 1 });
  const prog = (p: number) => setProgress((runRef.current.i + p) / runRef.current.n);
  const abort = useRef<AbortController | null>(null);
  const place = places.find((p) => p.id === placeId);

  // Ping, jitter & packet loss: 20 permintaan kecil berurutan, timeout 1,5 dtk.
  // Permintaan yang gagal/timeout dihitung sebagai "loss" (estimasi di level HTTP).
  async function measurePing(s: Server) {
    const N = 20;
    const rtts: number[] = [];
    let lost = 0;
    for (let i = 0; i < N + 1; i++) {
      const t0 = performance.now();
      try {
        const sig = abort.current ? AbortSignal.any([abort.current.signal, AbortSignal.timeout(1500)]) : AbortSignal.timeout(1500);
        const res = await fetch(s.ping(), { cache: "no-store", signal: sig });
        await res.arrayBuffer();
        if (!res.ok) throw new Error("status " + res.status);
        if (i > 0) rtts.push(performance.now() - t0);
      } catch (e) {
        if (abort.current?.signal.aborted) throw e;
        if (i > 0) lost++;
        else if (rtts.length === 0 && i === 0) {
          // permintaan pemanasan gagal: kemungkinan server tidak bisa dijangkau
          throw new Error("Server tidak bisa dijangkau");
        }
      }
      prog(0.12 * ((i + 1) / (N + 1)));
    }
    if (rtts.length < N / 2) throw new Error("Terlalu banyak paket hilang");
    const p = median(rtts);
    const diffs = rtts.slice(1).map((v, i) => Math.abs(v - rtts[i]));
    const j = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
    return { p, j, loss: (lost / N) * 100 };
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
      prog(0.12 + 0.48 * Math.min(1, (now - start) / (seconds * 1000)));
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
    const blob = new Blob([chunk], { type: "application/octet-stream" });
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
      prog(0.6 + 0.4 * Math.min(1, (now - start) / (seconds * 1000)));
    }, 200);
    await Promise.race([Promise.allSettled(Array.from({ length: 3 }, worker)), sleep(seconds * 1000 + 1500)]);
    xhrs.forEach((x) => x.abort());
    clearInterval(timer);
    const t = (performance.now() - start) / 1000;
    if (bytes === 0) throw new Error("Upload gagal");
    return (bytes * 8) / t / 1e6;
  }

  async function runOnce(s0: Server): Promise<{ run: Run; server: Server }> {
    setPing(null);
    setJitter(null);
    setLoss(null);
    setDown(null);
    setUp(null);
    setLive(null);
    setPhase("ping");
    let s = s0;
    let pj;
    try {
      pj = await measurePing(s);
    } catch (e) {
      if (abort.current?.signal.aborted || s.key !== "cf") throw e;
      s = SERVERS[1];
      pj = await measurePing(s);
    }
    setServer(s);
    setPing(pj.p);
    setJitter(pj.j);
    setLoss(pj.loss);
    setPhase("download");
    const short = runRef.current.n > 1;
    const d = await measureDown(s, short ? 6 : 8);
    setDown(d);
    setLive(null);
    setPhase("upload");
    const u = await measureUp(s, short ? 5 : 7);
    setUp(u);
    setLive(null);
    return { run: { down: d, up: u, ping: pj.p, jitter: pj.j, loss: pj.loss, at: new Date().toISOString() }, server: s };
  }

  async function run() {
    abort.current?.abort();
    abort.current = new AbortController();
    setErr("");
    setSaved("");
    setRuns([]);
    setProgress(0);
    const n = count;
    runRef.current = { i: 0, n };
    const done: Run[] = [];
    let s = SERVERS[0];
    try {
      for (let i = 0; i < n; i++) {
        runRef.current.i = i;
        setRunNo(i + 1);
        const r = await runOnce(s);
        s = r.server;
        done.push(r.run);
        setRuns([...done]);
        if (i < n - 1) await sleep(1500);
      }
      setProgress(1);
      setPhase("done");
    } catch (e) {
      if ((e as Error).name === "AbortError" || abort.current?.signal.aborted) {
        setPhase(done.length ? "done" : "idle");
        return;
      }
      setErr("Tes gagal: " + ((e as Error).message || "periksa koneksi") + ". Coba lagi.");
      setPhase(done.length ? "done" : "error");
    }
  }

  function cancel() {
    abort.current?.abort();
    setPhase("idle");
    setLive(null);
    setProgress(0);
  }

  async function save() {
    if (!placeId || !runs.length) return;
    setSaved("saving");
    const res = await fetch(admin ? "/api/admin/speeds" : "/api/speed/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, wifiId: wifiId || null, server: server.key === "cf" ? "Cloudflare" : "Nongki", results: runs }),
    });
    const j = await res.json().catch(() => ({ ok: false, error: "Respons server tidak valid" }));
    setSaved(j.ok ? "ok" : j.error || "Gagal menyimpan");
    if (j.ok) router.refresh();
  }

  // Setelah selesai di HP, arahkan ke kartu simpan.
  useEffect(() => {
    if (phase === "done" && window.innerWidth < 768) saveRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [phase]);

  const sessionStats = useMemo(
    () => (runs.length ? computeStats(runs.map((r, i) => ({ id: String(i), placeId: "", wifiId: null, server: "", by: "admin", createdAt: r.at, ...r }) as SpeedResult)) : null),
    [runs],
  );
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
    <Wrap admin={admin}>
      <div className={`grid gap-6 [&>*]:min-w-0 ${admin ? "lg:grid-cols-2" : "md:grid-cols-2"}`}>
        <section className={`space-y-4 bg-espresso-900 text-white ${admin ? "rounded-[22px] p-4 md:p-6" : "px-4 pt-5 pb-6 md:rounded-[26px] md:p-6"}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {admin ? <h2 className="text-xl font-extrabold">Tes kecepatan di lokasi</h2> : <h1 className="text-2xl font-extrabold">Cek Kecepatan</h1>}
            <span className="inline-flex items-center gap-1 text-xs text-cream-200">
              <Icon name="pin" size={12} /> {server.label}
            </span>
          </div>
          <Gauge value={gaugeVal} label={gaugeLabel} sub={sub} dark />
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-caramel-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tile("activity", "Ping", ping, "ms", st("ping"), 0)}
            {tile("activity", "Jitter · loss", jitter, loss != null ? `ms · ${fmtMbps(loss)}%` : "ms", st("ping"))}
            {tile("arrowdown", "Download", phase === "download" ? live : down, "Mbps", st("download"))}
            {tile("arrowup", "Upload", phase === "upload" ? live : up, "Mbps", st("upload"))}
          </div>
          {admin && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-cream-200">Jumlah tes per sesi</span>
              <div className="ml-auto flex rounded-full bg-white/10 p-1" role="radiogroup" aria-label="Jumlah tes">
                {[1, 3, 5].map((c) => (
                  <button key={c} role="radio" aria-checked={count === c} disabled={running} onClick={() => setCount(c)} className={`h-8 min-w-10 rounded-full px-3 text-xs font-bold ${count === c ? "bg-caramel-500 text-white" : "text-cream-200"}`}>
                    {c}×
                  </button>
                ))}
              </div>
            </div>
          )}
          {running && runRef.current.n > 1 && <p className="text-center text-xs font-semibold text-caramel-500">Tes {runNo} dari {runRef.current.n}</p>}
          {err && <p className="rounded-[10px] bg-slow-100 px-3 py-2 text-sm font-semibold text-slow-600">{err}</p>}
          {running ? (
            <button onClick={cancel} className="h-12 w-full rounded-[14px] border-[1.5px] border-white/60 font-semibold text-white">
              Batalkan tes
            </button>
          ) : (
            <button onClick={run} className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-mint-600 font-semibold text-white hover:opacity-90">
              <Icon name={phase === "done" ? "refresh" : "zap"} size={18} /> {phase === "done" || phase === "error" ? "Tes ulang" : count > 1 ? `Jalankan ${count} tes` : "Mulai tes"}
            </button>
          )}
          <p className="text-center text-xs text-cream-200/70">Satu tes memakai ±50–150 MB kuota{count > 1 ? ` (×${count})` : ""}. Dekati router agar hasil akurat.</p>
        </section>

        <section className={`space-y-4 ${admin ? "" : "px-4 pb-6 md:px-0"}`}>
          {sessionStats && (
            <WifiDetails stats={sessionStats} title="WiFi details — sesi ini" subtitle={`${runs.length} tes · ${server.key === "cf" ? "Cloudflare" : "server Nongki"}`} />
          )}
          {runs.length > 1 && (
            <div className="overflow-x-auto rounded-[18px] border border-line bg-white">
              <table className="w-full min-w-[420px] text-left text-xs tabular-nums">
                <thead className="bg-cream-100 text-ink-500">
                  <tr>
                    {["#", "Down", "Up", "Ping", "Jitter", "Loss", "Jam"].map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {runs.map((r, i) => (
                    <tr key={r.at}>
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold">{fmtMbps(r.down)}</td>
                      <td className="px-3 py-2">{fmtMbps(r.up)}</td>
                      <td className="px-3 py-2">{fmtMbps(r.ping)} ms</td>
                      <td className="px-3 py-2">{fmtMbps(r.jitter)} ms</td>
                      <td className="px-3 py-2">{fmtMbps(r.loss)}%</td>
                      <td className="px-3 py-2">{new Date(r.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
              <p>Ping, jitter &amp; packet loss diukur dari 20 permintaan kecil (yang gagal/timeout dihitung hilang), lalu download &amp; upload diukur ±8 detik dengan beberapa koneksi paralel ke server Cloudflare terdekat (otomatis pindah ke server Nongki jika gagal).</p>
              <p className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-full bg-mint-100 px-2.5 py-1 text-xs font-semibold text-mint-600">Cepat ≥ 30 Mbps</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-500">Sedang 10–30</span>
                <span className="rounded-full bg-slow-100 px-2.5 py-1 text-xs font-semibold text-slow-600">Lambat &lt; 10</span>
              </p>
            </div>
          )}

          <div ref={saveRef} className="space-y-3 rounded-[18px] border border-line bg-white p-4">
            <h2 className="font-bold">{admin ? "Simpan hasil ke tempat ini" : "Simpan hasil ke tempat"}</h2>
            {admin && place ? (
              <p className="text-sm text-ink-500">
                Hasil akan tercatat di <b className="text-ink-900">{place.name}</b> dengan label &quot;Diukur admin di lokasi&quot;. Pastikan kamu sedang terhubung ke WiFi tempat ini.
              </p>
            ) : (
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
            )}
            {place && place.wifi.length > 0 && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold">Diukur di WiFi mana? (opsional)</span>
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
            <button onClick={save} disabled={phase !== "done" || !runs.length || !placeId || saved === "saving" || saved === "ok"} className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-espresso-600 font-semibold text-white disabled:opacity-40">
              <Icon name={saved === "ok" ? "check" : "save"} size={18} /> {saved === "saving" ? "Menyimpan…" : saved === "ok" ? "Tersimpan" : runs.length > 1 ? `Simpan ${runs.length} hasil ke tempat ini` : "Simpan hasil ke tempat ini"}
            </button>
            {phase !== "done" && <p className="text-xs text-ink-500">Selesaikan tes dulu untuk menyimpan hasil.</p>}
            {phase === "done" && !placeId && <p className="text-xs font-semibold text-amber-500">Pilih tempat tempat kamu sedang berada.</p>}
            {saved === "ok" && admin && <p className="text-sm font-semibold text-mint-600">Hasil disimpan dan muncul di riwayat di bawah.</p>}
            {saved === "ok" && place && !admin && (
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
    </Wrap>
  );
}

function Wrap({ admin, children }: { admin: boolean; children: React.ReactNode }) {
  return admin ? <div>{children}</div> : <main className="mx-auto max-w-6xl px-0 md:px-6 md:py-8">{children}</main>;
}
