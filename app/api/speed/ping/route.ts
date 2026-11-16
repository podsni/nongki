export const dynamic = "force-dynamic";

export function GET() {
  return new Response("pong", { headers: { "Cache-Control": "no-store, no-transform", "Content-Type": "text/plain" } });
}
