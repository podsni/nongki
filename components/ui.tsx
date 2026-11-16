import Link from "next/link";
import type { PlaceView, SpeedLevel } from "@/lib/types";
import { PRICE_LABEL } from "@/lib/types";
import { fmtMbps, fmtRp, photoSize } from "@/lib/util";
import { Icon } from "./Icon";

const GRADS = [
  ["#8A5A3B", "#2B1A12"],
  ["#7FB7A4", "#2F5D50"],
  ["#D9B48F", "#6B3F26"],
  ["#E3A06B", "#8C3B2E"],
  ["#5E7C8B", "#22313A"],
  ["#B5C99A", "#4F6B3A"],
  ["#C8864B", "#4A2C1D"],
];
export function gradFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADS[h % GRADS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function Photo({ place, className = "", children, w = 640, h = 480 }: { place: Pick<PlaceView, "id" | "photoUrl" | "name">; className?: string; children?: React.ReactNode; w?: number; h?: number }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: gradFor(place.id) }}>
      {place.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoSize(place.photoUrl, w, h)} alt={place.name} className="absolute inset-0 size-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/35">
          <Icon name="coffee" size={40} />
        </div>
      )}
      {children}
    </div>
  );
}

const LV: Record<SpeedLevel, string> = {
  Cepat: "bg-mint-100 text-mint-600",
  Sedang: "bg-amber-100 text-amber-500",
  Lambat: "bg-slow-100 text-slow-600",
};

export function WifiBadge({ level, mbps, className = "", label }: { level: SpeedLevel | null; mbps: number | null; className?: string; label?: string }) {
  if (!level) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-500 ${className}`}>
        <Icon name="wifi" size={13} strokeWidth={2.4} /> {label ?? "Belum dites"}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${LV[level]} ${className}`} title={`WiFi ${level}`}>
      <Icon name="wifi" size={13} strokeWidth={2.4} /> {label ?? `${fmtMbps(mbps, 0)} Mbps`}
    </span>
  );
}

export function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-semibold text-espresso-600 ${className}`}>{children}</span>;
}


export function Rating({ place }: { place: Pick<PlaceView, "rating" | "reviews"> }) {
  if (place.rating == null) return <span className="text-xs text-ink-500">Belum ada rating</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-900">
      <Icon name="star" size={13} className="text-star" fill="currentColor" />
      {place.rating.toLocaleString("id-ID")}
      {place.reviews != null && <span className="font-normal text-ink-500">({place.reviews.toLocaleString("id-ID")})</span>}
    </span>
  );
}

export function priceLabel(p: Pick<PlaceView, "priceLevel" | "priceText">) {
  if (p.priceLevel) return PRICE_LABEL[p.priceLevel];
  return p.priceText || "";
}

export function PlaceCard({ place }: { place: PlaceView }) {
  return (
    <Link href={`/tempat/${place.slug}`} className="group block w-64 shrink-0 overflow-hidden rounded-[18px] bg-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 sm:w-auto">
      <Photo place={place} className="h-36">
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between">
          <WifiBadge level={place.level} mbps={place.avgDown} />
        </div>
      </Photo>
      <div className="space-y-1.5 p-3">
        <h3 className="truncate text-sm font-semibold group-hover:text-espresso-600">{place.name}</h3>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <Rating place={place} />
          {place.area && (
            <>
              <span>•</span>
              <span className="truncate">{place.area}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          {place.americano ? (
            <span className="inline-flex items-center gap-1 font-semibold text-espresso-600" title="Harga Americano">
              <Icon name="coffee" size={13} /> Americano {fmtRp(place.americano.price, true)}
            </span>
          ) : (
            <span className="font-semibold text-caramel-500">{priceLabel(place) || " "}</span>
          )}
          {place.is24h ? <span className="text-mint-600">Buka 24 jam</span> : <span className="text-ink-500">{place.wifi.length} WiFi</span>}
        </div>
      </div>
    </Link>
  );
}

export function PlaceRow({ place, extra }: { place: PlaceView; extra?: React.ReactNode }) {
  return (
    <Link href={`/tempat/${place.slug}`} className="flex items-center gap-3 rounded-[18px] border border-line bg-white p-3 transition hover:border-caramel-500">
      <Photo place={place} className="h-24 w-20 shrink-0 rounded-[14px] sm:w-24" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{place.name}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <Rating place={place} />
          {priceLabel(place) && <span className="font-semibold text-caramel-500">{priceLabel(place)}</span>}
        </div>
        <p className="flex items-center gap-1 truncate text-xs text-ink-500">
          <Icon name="pin" size={13} className="shrink-0" />
          <span className="truncate">{place.area || place.address}</span>
          {extra}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <WifiBadge level={place.level} mbps={place.avgDown} />
          {place.americano && <Tag>☕ Americano {fmtRp(place.americano.price, true)}</Tag>}
          {place.is24h && <Tag>Buka 24 jam</Tag>}
          {place.wifi.length > 0 && <Tag>{place.wifi.length} WiFi</Tag>}
        </div>
      </div>
    </Link>
  );
}

export function SectionHeader({ title, href, action = "Lihat semua" }: { title: string; href?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold md:text-lg">{title}</h2>
      {href && (
        <Link href={href} className="text-xs font-semibold text-espresso-600 hover:underline">
          {action}
        </Link>
      )}
    </div>
  );
}
