"use client";
import { useMemo, useState } from "react";
import type { MenuPrice } from "@/lib/types";
import { fmtDate, fmtRp } from "@/lib/util";
import { Icon } from "./Icon";

const OTHER = "Lainnya";
const BUDGETS = [
  { key: "all", label: "Semua harga", max: Infinity },
  { key: "15", label: "≤ Rp15rb", max: 15000 },
  { key: "25", label: "≤ Rp25rb", max: 25000 },
] as const;

export function MenuSection({ menu }: { menu: MenuPrice[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [budget, setBudget] = useState<(typeof BUDGETS)[number]["key"]>("all");

  const cats = useMemo(() => {
    const order: string[] = [];
    for (const m of menu) {
      const c = m.category?.trim() || OTHER;
      if (!order.includes(c)) order.push(c);
    }
    return order.sort((a, b) => (a === OTHER ? 1 : b === OTHER ? -1 : 0));
  }, [menu]);
  const prices = menu.map((m) => m.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const latestManual = menu.filter((m) => m.source !== "foto").map((m) => m.checkedAt).filter(Boolean).sort().pop();
  const photoItems = menu.filter((m) => m.source === "foto");
  const latestPhoto = photoItems.map((m) => m.checkedAt).filter(Boolean).sort().pop();

  const max = BUDGETS.find((b) => b.key === budget)!.max;
  const needle = q.trim().toLowerCase();
  const shown = menu.filter((m) => (cat === "all" || (m.category?.trim() || OTHER) === cat) && m.price <= max && (!needle || `${m.item} ${m.note} ${m.category ?? ""}`.toLowerCase().includes(needle)));
  const groups = cats.map((c) => [c, shown.filter((m) => (m.category?.trim() || OTHER) === c)] as const).filter(([, l]) => l.length);

  return (
    <section id="menu" className="scroll-mt-20 space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Menu & harga</h2>
          <p className="text-xs text-ink-500">
            {menu.length} item · {lo === hi ? fmtRp(lo) : `${fmtRp(lo)} – ${fmtRp(hi)}`}
          </p>
        </div>
      </div>
      <div className="space-y-3 rounded-[18px] border border-line bg-white p-3 md:p-4">
        {menu.length > 6 && (
          <>
            <label className="flex h-11 items-center gap-2 rounded-[14px] border border-line bg-cream-50 px-3 focus-within:border-espresso-600">
              <Icon name="search" size={18} className="shrink-0 text-ink-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu, mis. latte" aria-label="Cari menu" className="w-full min-w-0 bg-transparent text-sm outline-none" />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Hapus pencarian" className="grid size-8 place-items-center text-ink-500">
                  <Icon name="x" size={16} />
                </button>
              )}
            </label>
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:-mx-4 md:px-4">
              {["all", ...cats].map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${cat === c ? "border-espresso-600 bg-espresso-600 text-white" : "border-line bg-white text-ink-900"}`}>
                  {c === "all" ? "Semua" : c}
                </button>
              ))}
              <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />
              {BUDGETS.slice(1).map((b) => (
                <button key={b.key} type="button" onClick={() => setBudget(budget === b.key ? "all" : b.key)} aria-pressed={budget === b.key} className={`h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${budget === b.key ? "border-mint-600 bg-mint-100 text-mint-600" : "border-line bg-white text-ink-900"}`}>
                  {b.label}
                </button>
              ))}
            </div>
          </>
        )}
        {groups.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">Tidak ada menu yang cocok.</p>
        ) : (
          <div className="space-y-4">
            {groups.map(([c, list]) => (
              <div key={c}>
                {cats.length > 1 && <h3 className="mb-1 text-xs font-bold tracking-wide text-caramel-500 uppercase">{c}</h3>}
                <ul className="divide-y divide-dashed divide-line">
                  {list.map((m) => (
                    <li key={m.id} className="flex items-baseline gap-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{m.item}</span>
                        {m.note && <span className="text-ink-500"> · {m.note}</span>}
                      </span>
                      <span className="shrink-0 font-bold text-espresso-600 tabular-nums">{fmtRp(m.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="border-t border-line pt-2 text-[11px] text-ink-500">
          {[
            latestManual && `Dicek admin per ${fmtDate(latestManual)}`,
            photoItems.length > 0 && (latestPhoto ? `${photoItems.length} item dari foto menu (harga per ${fmtDate(latestPhoto)})` : `${photoItems.length} item dibaca dari foto menu di Google Maps (tanggal foto tidak diketahui)`),
            "harga bisa berubah, cek di kasir",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </section>
  );
}
