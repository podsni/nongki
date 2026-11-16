import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LoginForm } from "@/components/admin/LoginForm";
import { DeleteButton } from "@/components/admin/PlaceForm";
import { ExampleTag, Photo, Rating, WifiBadge } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { storageMode } from "@/lib/db";
import { listPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!(await isAdmin())) return <LoginForm />;
  const places = await listPlaces();
  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Kelola tempat</h1>
          <p className="text-sm text-ink-500">
            {places.length} tempat · penyimpanan: {storageMode() === "blob" ? "Vercel Blob" : "file lokal"}
          </p>
        </div>
        <Link href="/admin/tambah" className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-espresso-600 px-4 text-sm font-semibold text-white">
          <Icon name="plus" size={18} /> Tambah dari Google Maps
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {places.map((p) => (
          <div key={p.id} className="flex gap-3 rounded-[18px] border border-line bg-white p-3">
            <Photo place={p} className="h-20 w-20 shrink-0 rounded-[14px]" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold">{p.name}</p>
                {p.isExample && <ExampleTag />}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <Rating place={p} /> · {p.wifi.length} WiFi · {p.speedCount} tes
              </div>
              <WifiBadge level={p.level} mbps={p.avgDown} />
              <div className="flex gap-2 pt-1">
                <Link href={`/admin/tempat/${p.id}`} className="inline-flex items-center gap-1 rounded-[10px] bg-cream-100 px-3 py-1.5 text-xs font-semibold text-espresso-600">
                  <Icon name="edit" size={13} /> Edit
                </Link>
                <Link href={`/tempat/${p.slug}`} className="inline-flex items-center gap-1 rounded-[10px] border border-line px-3 py-1.5 text-xs font-semibold text-ink-500">
                  Lihat
                </Link>
                <DeleteButton id={p.id} name={p.name} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
