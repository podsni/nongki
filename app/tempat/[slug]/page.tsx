import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ShareButton, WifiList } from "@/components/PlaceClient";
import { GalleryGrid, GalleryHero } from "@/components/Gallery";
import { gradFor, priceLabel, Rating, Tag, WifiBadge } from "@/components/ui";
import { getPlace } from "@/lib/places";
import { FACILITIES } from "@/lib/types";
import { fmtMbps, levelOf, mapsRouteUrl, openStatus, timeAgo } from "@/lib/util";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await getPlace((await params).slug);
  return r ? { title: r.place.name, description: `${r.place.name} — ${r.place.address}` } : { title: "Tempat tidak ditemukan" };
}

const LVC = { Cepat: "bg-mint-100 text-mint-600", Sedang: "bg-amber-100 text-amber-500", Lambat: "bg-slow-100 text-slow-600" } as const;

export default async function Detail({ params }: Props) {
  const r = await getPlace((await params).slug);
  if (!r) notFound();
  const { place: p, speeds } = r;
  const facs = FACILITIES.filter((f) => p.facilities.includes(f.key));
  const wifiName = (id: string | null) => p.wifi.find((w) => w.id === id)?.ssid;
  const status = openStatus(p);
  const today = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" }).format(new Date());

  const info = (
    <div className="divide-y divide-line rounded-[18px] border border-line bg-white px-4">
      <Row icon="pin" label="Alamat">
        {p.address || "—"}
      </Row>
      <Row icon="clock" label="Jam buka">
        {p.is24h ? (
          <span className="font-semibold text-mint-600">Buka 24 jam • setiap hari</span>
        ) : p.hours.length ? (
          <ul className="space-y-0.5">
            {p.hours.map((h) => (
              <li key={h.day} className={`flex justify-between gap-4 ${h.day.toLowerCase() === today.toLowerCase() ? "font-semibold text-espresso-600" : ""}`}>
                <span>{h.day}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </Row>
      <Row icon="coins" label="Kisaran harga">
        {[priceLabel(p), p.priceText && p.priceLevel ? p.priceText : ""].filter(Boolean).join(" • ") || "—"}
      </Row>
      {p.phone && (
        <Row icon="phone" label="Telepon">
          <a href={`tel:${p.phone}`} className="text-espresso-600">
            {p.phone}
          </a>
        </Row>
      )}
      {p.mapsUrl && (
        <Row icon="link" label="Sumber data">
          <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-espresso-600 hover:underline">
            Buka di Google Maps
          </a>
        </Row>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl md:px-6 md:py-8">
      <GalleryHero photos={p.photos} name={p.name} fallback={gradFor(p.id)} />
      <div className="md:mt-2 md:grid md:grid-cols-[1.1fr_0.9fr] md:gap-8 [&>*]:min-w-0">
        <div>
          <div className="relative -mt-6 space-y-6 rounded-t-[24px] bg-cream-50 px-4 pt-5 pb-6 md:mt-6 md:rounded-none md:bg-transparent md:px-0">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {p.categories.includes("kopi") && <Tag>Kedai kopi</Tag>}
                {status && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.open ? "bg-mint-100 text-mint-600" : "bg-slow-100 text-slow-600"}`}>
                    <span className={`size-1.5 rounded-full ${status.open ? "bg-mint-600" : "bg-slow-600"}`} /> {status.label}
                  </span>
                )}
                {priceLabel(p) && <Tag>{priceLabel(p)}</Tag>}
              </div>
              <h1 className="text-2xl leading-tight font-extrabold md:text-3xl">{p.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
                <Rating place={p} />
                {p.reviews != null && <span>ulasan Google</span>}
                {p.area && <span>• {p.area}</span>}
              </div>
              {p.description && <p className="text-sm text-ink-500">{p.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a href={mapsRouteUrl(p)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-espresso-600 font-semibold text-white hover:bg-espresso-700">
                <Icon name="nav" size={18} /> Rute
              </a>
              <ShareButton title={p.name} text={`${p.name} — ${p.address}`} className="flex h-12 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-espresso-600 bg-white font-semibold text-espresso-600" />
            </div>
            {info}
            {facs.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-bold">Fasilitas</h2>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {facs.map((f) => (
                    <div key={f.key} className="flex flex-col items-center gap-1.5 rounded-[14px] border border-line bg-white px-1 py-3 text-center">
                      <Icon name={f.icon} size={22} className="text-espresso-600" />
                      <span className="text-xs font-semibold">{f.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="space-y-6 px-4 pb-8 md:px-0 md:pt-0">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Internet di sini</h2>
              <Link href={`/cek-speed?tempat=${p.slug}`} className="text-xs font-semibold text-espresso-600 hover:underline">
                Cek sekarang
              </Link>
            </div>
            <div className="space-y-4 rounded-[18px] border border-line bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-ink-500">{speeds.length ? `Rata-rata ${Math.min(speeds.length, 5)} tes terakhir` : "Belum ada tes kecepatan"}</p>
                  {p.avgDown != null ? (
                    <p className="text-4xl font-extrabold tracking-tight">
                      {fmtMbps(p.avgDown)} <span className="text-sm font-semibold text-ink-500">Mbps</span>
                    </p>
                  ) : (
                    <p className="pt-1 text-lg font-bold text-ink-500">Belum diukur</p>
                  )}
                </div>
                <WifiBadge level={p.level} mbps={p.avgDown} label={p.level ?? "Belum dites"} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Metric icon="arrowdown" color="text-mint-600" label="Download" value={fmtMbps(p.avgDown)} unit="Mbps" />
                <Metric icon="arrowup" color="text-caramel-500" label="Upload" value={fmtMbps(p.avgUp)} unit="Mbps" />
                <Metric icon="activity" color="text-espresso-600" label="Ping" value={p.avgPing != null ? String(Math.round(p.avgPing)) : "—"} unit="ms" />
              </div>
              <Link href={`/cek-speed?tempat=${p.slug}`} className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-mint-600 font-semibold text-white hover:opacity-90">
                <Icon name="zap" size={18} /> Cek kecepatan internet
              </Link>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">WiFi di tempat ini</h2>
              <span className="text-xs text-ink-500">{p.wifi.length} jaringan</span>
            </div>
            <WifiList wifi={p.wifi} />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">Riwayat speed test</h2>
            {speeds.length === 0 ? (
              <p className="rounded-[18px] border border-dashed border-line p-4 text-sm text-ink-500">Belum ada. Jadilah yang pertama cek internet di sini!</p>
            ) : (
              <div className="divide-y divide-line rounded-[18px] border border-line bg-white px-4">
                {speeds.slice(0, 10).map((s) => {
                  const lv = levelOf(s.down)!;
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-[14px] ${LVC[lv]}`}>
                        <Icon name="zap" size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          ↓ {fmtMbps(s.down)} ↑ {fmtMbps(s.up)} Mbps
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          Ping {s.ping} ms • jitter {fmtMbps(s.jitter)} ms • {timeAgo(s.createdAt)}
                          {wifiName(s.wifiId) ? ` • ${wifiName(s.wifiId)}` : ""}
                        </p>
                        {s.by === "admin" && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-espresso-600/10 px-2 py-0.5 text-[11px] font-semibold text-espresso-600">
                            <Icon name="shield" size={11} strokeWidth={2.6} /> Diukur admin di lokasi
                          </span>
                        )}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LVC[lv]}`}>{lv}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      <div className="px-4 pb-10 md:px-0">
        <GalleryGrid photos={p.photos} name={p.name} />
      </div>
    </main>
  );
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-cream-100 text-espresso-600">
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-ink-500">{label}</p>
        <div className="font-medium">{children}</div>
      </div>
    </div>
  );
}

function Metric({ icon, color, label, value, unit }: { icon: string; color: string; label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[14px] bg-cream-100 p-3">
      <p className="flex items-center gap-1 text-xs text-ink-500">
        <Icon name={icon} size={13} className={color} strokeWidth={2.4} /> {label}
      </p>
      <p className="text-lg font-bold">
        {value} <span className="text-xs font-normal text-ink-500">{unit}</span>
      </p>
    </div>
  );
}
