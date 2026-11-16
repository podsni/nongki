"use client";
import { useState } from "react";
import type { Wifi } from "@/lib/types";
import { Icon } from "./Icon";
import { fmtMbps } from "@/lib/util";
import type { WifiStats } from "@/lib/wifistats";
import { WifiDetails } from "./WifiDetails";

export async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function useToast() {
  const [msg, setMsg] = useState("");
  const show = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(""), 2200);
  };
  const node = msg ? (
    <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-[14px] bg-espresso-900 px-4 py-3 text-sm font-medium text-white shadow-lg md:bottom-8">
      <Icon name="check" size={16} className="text-mint-100" strokeWidth={3} /> {msg}
    </div>
  ) : null;
  return { show, node };
}

export function ShareButton({ title, text, className = "" }: { title: string; text: string; className?: string }) {
  const toast = useToast();
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    if (await copyText(url)) toast.show("Link disalin ke clipboard");
  }
  return (
    <>
      <button onClick={share} className={className}>
        <Icon name="share" size={18} /> Bagikan
      </button>
      {toast.node}
    </>
  );
}

function WifiItem({ w, onCopy, stats }: { w: Wifi; onCopy: (m: string) => void; stats?: WifiStats | null }) {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-[18px] border border-line bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-[#2bc59b] to-[#0f7f63] text-white">
          <Icon name="wifi" size={22} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{w.ssid}</p>
          <p className="truncate text-xs text-ink-500">{w.note || "Nama WiFi (SSID)"}</p>
        </div>
        <button onClick={async () => (await copyText(w.ssid)) && onCopy(`Nama WiFi “${w.ssid}” disalin`)} className="inline-flex items-center gap-1 rounded-[10px] border border-line px-2.5 py-1.5 text-xs font-semibold text-espresso-600 hover:border-caramel-500">
          <Icon name="copy" size={13} /> SSID
        </button>
      </div>
      {w.password ? (
        <div className="flex h-12 items-center gap-2 rounded-[10px] bg-cream-100 pr-1.5 pl-3">
          <Icon name="lock" size={16} className="shrink-0 text-ink-500" />
          <span className={`min-w-0 flex-1 truncate font-semibold ${show ? "font-mono text-sm" : "tracking-widest"}`} aria-label={show ? "Password" : "Password tersembunyi"}>
            {show ? w.password : "•".repeat(Math.min(Math.max(w.password.length, 8), 14))}
          </span>
          <button onClick={() => setShow((s) => !s)} className={`grid size-9 place-items-center rounded-[8px] text-espresso-600 ${show ? "bg-caramel-100" : ""}`} aria-label={show ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={show}>
            <Icon name={show ? "eyeoff" : "eye"} size={18} />
          </button>
          <button onClick={async () => (await copyText(w.password)) && onCopy(`Password ${w.ssid} disalin`)} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-espresso-600 px-3 text-xs font-semibold text-white">
            <Icon name="copy" size={14} /> Salin
          </button>
        </div>
      ) : (
        <p className="rounded-[10px] bg-mint-100 px-3 py-2 text-xs font-semibold text-mint-600">WiFi terbuka — tanpa password</p>
      )}
      {stats ? (
        <div>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2 text-left text-xs font-semibold text-ink-900 hover:border-caramel-500">
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon name="activity" size={14} className="shrink-0 text-mint-600" />
              <span className="truncate">
                ↓ {fmtMbps(stats.down[0])}–{fmtMbps(stats.down[1])} Mbps · {stats.tests} tes
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-espresso-600">
              {open ? "Tutup" : "Detail WiFi"} <Icon name="chevdown" size={14} className={open ? "rotate-180" : ""} />
            </span>
          </button>
          {open && <WifiDetails stats={stats} className="mt-2 border-dashed" subtitle={`Dari ${stats.tests} tes untuk ${w.ssid}`} />}
        </div>
      ) : (
        <p className="text-xs text-ink-500">Belum ada tes kecepatan untuk jaringan ini.</p>
      )}
    </div>
  );
}

export function WifiList({ wifi, stats = {} }: { wifi: Wifi[]; stats?: Record<string, WifiStats | null> }) {
  const toast = useToast();
  if (!wifi.length) return <p className="rounded-[18px] border border-dashed border-line p-4 text-sm text-ink-500">Belum ada data WiFi untuk tempat ini.</p>;
  return (
    <div className="space-y-3">
      {wifi.map((w) => (
        <WifiItem key={w.id} w={w} onCopy={toast.show} stats={stats[w.id]} />
      ))}
      {toast.node}
    </div>
  );
}
