import "server-only";
import { isAdmin } from "./auth";

export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json({ ok: false, error: "Belum login" }, { status: 401 });
}

export function errorJson(e: unknown, status = 400) {
  return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });
}
