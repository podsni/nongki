export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const t0 = Date.now();
  let bytes = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 30_000_000) break;
    }
  }
  return Response.json({ bytes, ms: Date.now() - t0 }, { headers: { "Cache-Control": "no-store" } });
}
