"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/", label: "Beranda", icon: "home" },
  { href: "/jelajah", label: "Jelajah", icon: "compass" },
  { href: "/cek-speed", label: "Cek Speed", icon: "zap" },
  { href: "/jelajah?view=peta", label: "Peta", icon: "map" },
];

function active(path: string, href: string) {
  const base = href.split("?")[0];
  if (base === "/") return path === "/";
  return path.startsWith(base) && !href.includes("view=peta");
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Nongki beranda">
      <span className="grid size-9 place-items-center rounded-xl bg-caramel-500 text-white">
        <Icon name="coffee" size={20} />
      </span>
      <span className={`font-display text-2xl font-bold ${light ? "text-cream-50" : "text-espresso-900"}`}>Nongki</span>
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  return (
    <header className="sticky top-0 z-40 hidden border-b border-line bg-cream-50/90 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          {ITEMS.slice(0, 3).map((it) => (
            <Link key={it.href} href={it.href} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active(path, it.href) ? "bg-cream-100 text-espresso-600" : "text-ink-500 hover:text-espresso-600"}`}>
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/cek-speed" className="flex items-center gap-2 rounded-xl bg-mint-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Icon name="zap" size={16} /> Cek internet
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-sticky)] md:hidden" aria-label="Navigasi utama">
      <div className="mx-auto flex max-w-md justify-between px-2 pt-2 pb-2">
        {ITEMS.map((it) => {
          const on = active(path, it.href);
          return (
            <Link key={it.href} href={it.href} className="flex w-20 flex-col items-center gap-1">
              <span className={`grid h-8 w-14 place-items-center rounded-full ${on ? "bg-cream-100 text-espresso-600" : "text-ink-500"}`}>
                <Icon name={it.icon} size={22} />
              </span>
              <span className={`text-xs ${on ? "font-semibold text-espresso-600" : "text-ink-500"}`}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
