import { cookies } from "next/headers";
import { checkPassword, COOKIE, cookieOptions, makeToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const attempts = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const a = attempts.get(ip);
  if (a && a.n >= 8 && Date.now() - a.t < 10 * 60_000) {
    return Response.json({ ok: false, error: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." }, { status: 429 });
  }
  let password = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) password = String(((await req.json()) as { password?: string }).password || "");
  else password = String((await req.formData()).get("password") || "");
  if (!checkPassword(password)) {
    attempts.set(ip, { n: (a && Date.now() - a.t < 10 * 60_000 ? a.n : 0) + 1, t: Date.now() });
    return Response.json({ ok: false, error: "Password salah" }, { status: 401 });
  }
  attempts.delete(ip);
  (await cookies()).set(COOKIE, makeToken(), cookieOptions);
  return Response.json({ ok: true });
}
