export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CHUNK = (() => {
  const b = new Uint8Array(64 * 1024);
  crypto.getRandomValues(b);
  return b;
})();

export function GET(req: Request) {
  const url = new URL(req.url);
  const total = Math.min(Math.max(Number(url.searchParams.get("bytes")) || 1_000_000, 1), 25_000_000);
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) return controller.close();
      const n = Math.min(CHUNK.length, total - sent);
      controller.enqueue(n === CHUNK.length ? CHUNK : CHUNK.subarray(0, n));
      sent += n;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(total),
      "Cache-Control": "no-store, no-transform",
      "Content-Encoding": "identity",
    },
  });
}
