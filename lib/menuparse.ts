// Utilitas murni (dipakai server & browser) untuk membaca harga menu berformat Indonesia.

export type ExtractedItem = { category: string; item: string; price: number; note: string };

/** "25K", "25k", "25rb", "25.000", "Rp 25.000", "25,5K", "25" (konteks ribuan) → 25000. null bila tidak masuk akal. */
export function parseRupiah(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return sane(raw < 1000 ? raw * 1000 : raw);
  const s = raw.toLowerCase().replace(/\s+/g, "").replace(/^rp\.?/, "").replace(/idr/, "");
  let m = s.match(/^(\d+(?:[.,]\d+)?)(k|rb|ribu)$/);
  if (m) return sane(Math.round(Number(m[1].replace(",", ".")) * 1000));
  m = s.match(/^(\d{1,3}(?:[.,]\d{3})+)(?:,-|,00|-)?$/);
  if (m) return sane(Number(m[1].replace(/[.,]/g, "")));
  m = s.match(/^(\d+)(?:,-|-)?$/);
  if (m) {
    const n = Number(m[1]);
    return sane(n < 1000 ? n * 1000 : n);
  }
  return null;
}

function sane(n: number): number | null {
  return isFinite(n) && n >= 1000 && n <= 2_000_000 ? Math.round(n / 100) * 100 : null;
}

const PRICE_RE = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d)?\s*(?:k|rb|ribu)|\d{2,6})(?:,-)?\s*$/i;
const HEADER_RE = /^[^\d]{3,30}$/;

/** Parser heuristik untuk teks OCR: baris "Nama ...... 25K" → item; baris tanpa harga & huruf besar → kategori. */
export function parseMenuText(text: string): ExtractedItem[] {
  const out: ExtractedItem[] = [];
  let category = "";
  for (const line0 of text.split(/\r?\n/)) {
    const line = line0.replace(/[|_~•·…]+/g, " ").replace(/\.{2,}|-{2,}/g, " ").replace(/\s+/g, " ").trim();
    if (line.length < 2) continue;
    const m = line.match(PRICE_RE);
    if (m) {
      const price = parseRupiah(m[1]);
      const name = line.slice(0, m.index).replace(/[:=\-–\s]+$/, "").trim();
      if (price && /[a-z]{2,}/i.test(name)) {
        const hc = name.match(/\s+(h\/c|hot\/ice|panas\/dingin|hot|ice|iced)$/i);
        out.push({ category, item: hc ? name.slice(0, hc.index).trim() : name, price, note: hc ? hc[1] : "" });
        continue;
      }
    }
    if (HEADER_RE.test(line) && line === line.toUpperCase() && /[A-Z]{3,}/.test(line)) category = titleCase(line);
  }
  return out;
}

export function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim();
}

/** Rapikan hasil (AI atau OCR): buang duplikat & baris tanpa nama/harga. */
export function cleanItems(items: Partial<ExtractedItem>[]): ExtractedItem[] {
  const seen = new Set<string>();
  const out: ExtractedItem[] = [];
  for (const it of items) {
    const item = String(it.item ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    const price = parseRupiah(it.price as number | string);
    if (!item || !price) continue;
    const note = String(it.note ?? "").trim().slice(0, 80);
    const k = `${item}|${note}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ category: String(it.category ?? "").trim().slice(0, 40), item, price, note });
  }
  return out;
}
