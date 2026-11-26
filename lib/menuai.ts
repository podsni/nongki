import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { cleanItems, type ExtractedItem } from "./menuparse";

export const MENU_MODEL = process.env.MENU_MODEL || "google/gemini-3-flash";

/** AI Gateway bisa dipakai bila ada API key, atau saat berjalan di Vercel (OIDC otomatis). */
export function aiAvailable() {
  return !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}

const schema = z.object({
  isMenu: z.boolean().describe("true bila setidaknya satu gambar berisi daftar menu/harga (papan, buku menu, struk)"),
  currencyNote: z.string().describe("catatan singkat, mis. 'harga dalam ribu (K)'"),
  items: z.array(
    z.object({
      category: z.string().describe("judul bagian menu, mis. 'Kopi', 'Non Coffee', 'Snack'; kosong bila tidak ada"),
      item: z.string().describe("nama menu persis seperti tertulis, huruf kapital wajar"),
      price: z.number().int().describe("harga dalam Rupiah penuh: 25K/25rb/25.000 → 25000"),
      note: z.string().describe("varian/ukuran/keterangan singkat, mis. 'Hot/Ice', 'Regular', 'Arabica'; kosong bila tidak ada"),
    }),
  ),
  unreadable: z.array(z.string()).describe("nama menu yang terlihat tapi harganya tidak terbaca/tertutup"),
});

const PROMPT = `Kamu membaca foto menu kafe di Indonesia. Ekstrak SEMUA item menu beserta harganya.
Aturan:
- Hanya tulis item yang harganya benar-benar terbaca jelas. Jangan menebak. Item yang harganya tertutup/tidak jelas masukkan ke "unreadable".
- Harga ke Rupiah penuh (integer): "25K", "25k", "25rb", "25" di menu berlabel ribuan → 25000; "25.000" → 25000.
- Satu item dengan beberapa harga (mis. Hot 18K / Ice 20K, atau Regular/Large) → buat baris terpisah dengan note varian.
- Satu harga untuk beberapa rasa (mis. "Vanilla, Hazelnut, Caramel } 14K") → satu baris per rasa dengan harga yang sama.
- Gunakan judul bagian sebagai category. Jangan masukkan tambahan (+2K extra shot) sebagai item kecuali jelas sebagai menu, tulis di note bila relevan.
- Jika gambar bukan menu (foto suasana/makanan tanpa harga), kembalikan isMenu=false dan items kosong.`;

export async function extractMenuAI(images: { data: Uint8Array; mediaType: string }[]): Promise<{ items: ExtractedItem[]; unreadable: string[]; isMenu: boolean; model: string }> {
  const { output } = await generateText({
    model: MENU_MODEL,
    output: Output.object({ schema }),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: PROMPT }, ...images.map((im) => ({ type: "file" as const, mediaType: im.mediaType, data: im.data }))],
      },
    ],
  });
  return { items: cleanItems(output.items), unreadable: output.unreadable.slice(0, 40), isMenu: output.isMenu, model: MENU_MODEL };
}
