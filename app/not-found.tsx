import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="font-display text-6xl font-bold text-espresso-600">404</p>
      <h1 className="mt-3 text-xl font-extrabold">Tempatnya nggak ketemu</h1>
      <p className="mt-2 text-sm text-ink-500">Mungkin sudah dihapus atau link-nya salah.</p>
      <Link href="/jelajah" className="mt-6 inline-flex h-12 items-center rounded-[14px] bg-espresso-600 px-5 font-semibold text-white">Jelajah tempat</Link>
    </main>
  );
}
