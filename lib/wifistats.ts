import type { SpeedResult } from "./types";

/** Tes yang jaraknya <= 30 menit dari tes sebelumnya dianggap satu sesi. */
export const SESSION_GAP_MS = 30 * 60_000;

export type Range = [number, number];
export type Variability = "rendah" | "sedang" | "tinggi";
export type WifiStats = {
  tests: number;
  sessions: number;
  down: Range;
  up: Range;
  ping: Range;
  jitter: number; // rata-rata ms
  loss: number | null; // rata-rata %, null jika tidak ada data loss
  variability: Variability | null; // null jika < 2 tes
  cv: number | null; // koefisien variasi download
  latest: { start: string; end: string; tests: number; label: string };
};

const range = (xs: number[]): Range => [Math.min(...xs), Math.max(...xs)];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function variabilityOf(cv: number): Variability {
  if (cv < 0.15) return "rendah";
  if (cv < 0.35) return "sedang";
  return "tinggi";
}

export function groupSessions(tests: SpeedResult[]): SpeedResult[][] {
  const sorted = [...tests].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const out: SpeedResult[][] = [];
  for (const t of sorted) {
    const cur = out[out.length - 1];
    if (cur && Date.parse(t.createdAt) - Date.parse(cur[cur.length - 1].createdAt) <= SESSION_GAP_MS) cur.push(t);
    else out.push([t]);
  }
  return out;
}

const WIB = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function wibParts(iso: string) {
  const p = Object.fromEntries(WIB.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

/** "2026-10-20 13:53–13:55 WIB" (atau dua tanggal jika lewat tengah malam). */
export function sessionLabel(startIso: string, endIso: string): string {
  const a = wibParts(startIso), b = wibParts(endIso);
  if (a.date === b.date) return a.time === b.time ? `${a.date} ${a.time} WIB` : `${a.date} ${a.time}–${b.time} WIB`;
  return `${a.date} ${a.time} – ${b.date} ${b.time} WIB`;
}

export function computeStats(tests: SpeedResult[]): WifiStats | null {
  if (!tests.length) return null;
  const downs = tests.map((t) => t.down);
  const sessions = groupSessions(tests);
  const last = sessions[sessions.length - 1];
  const losses = tests.map((t) => t.loss).filter((x): x is number => typeof x === "number");
  let cv: number | null = null;
  if (tests.length >= 2) {
    const m = mean(downs);
    const sd = Math.sqrt(mean(downs.map((d) => (d - m) ** 2)));
    cv = m > 0 ? sd / m : 0;
  }
  return {
    tests: tests.length,
    sessions: sessions.length,
    down: range(downs),
    up: range(tests.map((t) => t.up)),
    ping: range(tests.map((t) => t.ping)),
    jitter: mean(tests.map((t) => t.jitter)),
    loss: losses.length ? mean(losses) : null,
    variability: cv == null ? null : variabilityOf(cv),
    cv,
    latest: { start: last[0].createdAt, end: last[last.length - 1].createdAt, tests: last.length, label: sessionLabel(last[0].createdAt, last[last.length - 1].createdAt) },
  };
}
