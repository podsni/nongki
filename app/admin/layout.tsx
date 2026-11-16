import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Nav";
import { isAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ok = await isAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Logo />
          <span className="rounded-full bg-espresso-900 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">Admin</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="text-xs font-semibold text-ink-500 hover:text-espresso-600">
              Lihat situs
            </Link>
            {ok && <LogoutButton />}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
