import type { Range, WifiStats } from "@/lib/wifistats";
import { Icon } from "./Icon";

const n1 = (x: number) => x.toLocaleString("id-ID", { maximumFractionDigits: x >= 100 ? 0 : 1 });
const rng = ([a, b]: Range, unit: string) => (Math.abs(a - b) < 0.05 ? `${n1(a)} ${unit}` : `${n1(a)}–${n1(b)} ${unit}`);
const VAR = {
  rendah: "bg-mint-100 text-mint-600",
  sedang: "bg-amber-100 text-amber-500",
  tinggi: "bg-slow-100 text-slow-600",
} as const;
const VAR_HINT = { rendah: "kecepatan stabil", sedang: "naik-turun wajar", tinggi: "sering naik-turun" } as const;

/** Panel "WiFi Details": ringkasan statistik dari hasil speed test tersimpan. */
export function WifiDetails({ stats, title = "WiFi details", subtitle, dark = false, className = "" }: { stats: WifiStats; title?: string; subtitle?: string; dark?: boolean; className?: string }) {
  const rows: { label: string; value: React.ReactNode; wide?: boolean }[] = [
    { label: "Rentang download", value: rng(stats.down, "Mbps") },
    { label: "Rentang upload", value: rng(stats.up, "Mbps") },
    { label: "Rentang ping", value: rng(stats.ping, "ms") },
    { label: "Jitter · loss", value: `${n1(stats.jitter)} ms · ${stats.loss == null ? "—" : n1(stats.loss) + "%"}` },
    {
      label: "Variabilitas",
      value: stats.variability ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${VAR[stats.variability]}`}>{stats.variability}</span>
          <span className={`text-xs font-normal ${dark ? "text-cream-200" : "text-ink-500"}`}>{VAR_HINT[stats.variability]}</span>
        </span>
      ) : (
        <span className={`text-xs font-normal ${dark ? "text-cream-200" : "text-ink-500"}`}>butuh ≥ 2 tes</span>
      ),
    },
    { label: "Jumlah tes", value: `${stats.tests} dalam ${stats.sessions} sesi` },
    { label: "Tes terakhir", value: stats.latest.label, wide: true },
  ];
  return (
    <section className={`rounded-[18px] border p-4 ${dark ? "border-white/10 bg-white/5 text-white" : "border-line bg-white"} ${className}`} data-testid="wifi-details">
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid size-8 place-items-center rounded-[10px] ${dark ? "bg-white/10" : "bg-mint-100 text-mint-600"}`}>
          <Icon name="activity" size={16} strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-[0.08em] uppercase">{title}</p>
          {subtitle && <p className={`truncate text-xs ${dark ? "text-cream-200" : "text-ink-500"}`}>{subtitle}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className={`min-w-0 ${r.wide ? "col-span-2" : ""}`}>
            <dt className={`text-[11px] font-semibold tracking-wide uppercase ${dark ? "text-cream-200/80" : "text-ink-500"}`}>{r.label}</dt>
            <dd className="text-sm font-bold tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
