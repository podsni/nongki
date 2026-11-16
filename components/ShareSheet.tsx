"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { copyText, useToast } from "./PlaceClient";

type Props = { url: string; title: string; text: string; storyUrl: string; slug: string; className?: string };

const enc = encodeURIComponent;

function Glyph({ k }: { k: "wa" | "tg" | "x" | "fb" }) {
  if (k === "wa")
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
      </svg>
    );
  if (k === "tg")
    return (
      <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden>
        <path d="M21.9 4.3 18.8 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.9 13 2.4 11.6c-1-.3-1-1 .2-1.5L20.5 3.2c.8-.3 1.6.2 1.4 1.1Z" />
      </svg>
    );
  if (k === "x")
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
        <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.9 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d="M14 8V6.3c0-.8.2-1.3 1.4-1.3H17V2.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V8H8v3.2h2.6V22H14V11.2h2.7L17 8h-3Z" />
    </svg>
  );
}

export function ShareSheet({ url, title, text, storyUrl, slug, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [canFiles, setCanFiles] = useState<boolean | null>(null);
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileName = `nongki-${slug}-story.png`;
  const plain = text.replace(url, "").trim();

  async function loadFile(): Promise<File | null> {
    if (file) return file;
    try {
      const r = await fetch(storyUrl);
      if (!r.ok) return null;
      const f = new File([await r.blob()], fileName, { type: "image/png" });
      setFile(f);
      setCanFiles(!!navigator.canShare?.({ files: [f] }));
      return f;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
     
  }, [open]);

  async function download(f?: File | null) {
    const a = document.createElement("a");
    if (f) {
      a.href = URL.createObjectURL(f);
      window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } else a.href = `${storyUrl}${storyUrl.includes("?") ? "&" : "?"}download=1`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function shareStory() {
    setBusy(true);
    try {
      const copied = await copyText(url);
      const f = file ?? (await loadFile());
      if (f && navigator.canShare?.({ files: [f] })) {
        try {
          await navigator.share({ files: [f], title });
          toast.show(copied ? "Link disalin — tempel sebagai stiker Link di story" : "Story siap dibagikan");
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      await download(f);
      toast.show(copied ? "Gambar story diunduh & link disalin. Unggah ke Story WA/IG." : "Gambar story diunduh. Unggah ke Story WA/IG.");
    } finally {
      setBusy(false);
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: plain, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    if (await copyText(url)) toast.show("Link disalin ke clipboard");
  }

  const targets = [
    { k: "wa" as const, label: "WhatsApp", bg: "bg-[#25D366]", href: `https://wa.me/?text=${enc(text)}` },
    { k: "tg" as const, label: "Telegram", bg: "bg-[#229ED9]", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(plain)}` },
    { k: "x" as const, label: "X", bg: "bg-black", href: `https://x.com/intent/post?text=${enc(`${title} — cek WiFi, password & harganya di Nongki`)}&url=${enc(url)}` },
    { k: "fb" as const, label: "Facebook", bg: "bg-[#1877F2]", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          void loadFile(); // siapkan file story selagi sheet terbuka agar share tetap dalam "user activation"
        }}
        className={className}
        aria-haspopup="dialog"
      >
        <Icon name="share" size={18} /> Bagikan
      </button>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-espresso-900/50 backdrop-blur-[2px] md:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="share-title" data-testid="share-sheet" onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[26px] bg-cream-50 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl md:rounded-[26px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="share-title" className="text-lg font-bold">
                Bagikan tempat
              </h2>
              <button ref={closeRef} onClick={() => setOpen(false)} aria-label="Tutup" className="grid size-9 place-items-center rounded-full bg-cream-100 text-ink-900">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="flex gap-4 rounded-[20px] border border-line bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={storyUrl} alt={`Gambar story ${title}`} className="aspect-[9/16] w-28 shrink-0 self-start rounded-[14px] bg-espresso-900 object-cover sm:w-32" />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                <p className="text-sm font-bold">Story WhatsApp &amp; Instagram</p>
                <p className="text-xs text-ink-500">Gambar 1080×1920 berisi foto, rating, harga Americano, WiFi &amp; QR link. Link ikut disalin untuk stiker Link.</p>
                <button onClick={shareStory} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-3 text-sm font-semibold text-white disabled:opacity-70" data-testid="share-story">
                  <Icon name={busy ? "loader" : "sparkle"} size={17} className={busy ? "animate-spin" : ""} /> Bagikan ke Story
                </button>
                <button onClick={() => download(file)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-line text-sm font-semibold text-espresso-600 hover:border-caramel-500" data-testid="download-story">
                  <Icon name="download" size={16} /> Unduh gambar story
                </button>
                {canFiles === false && <p className="text-[11px] text-ink-500">Browser ini tidak bisa langsung membagikan gambar — tombol Story akan mengunduh gambarnya.</p>}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {targets.map((t) => (
                <a key={t.k} href={t.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 rounded-[14px] p-2 text-center text-xs font-semibold hover:bg-cream-100">
                  <span className={`grid size-12 place-items-center rounded-full text-white ${t.bg}`}>
                    <Glyph k={t.k} />
                  </span>
                  {t.label}
                </a>
              ))}
              <button onClick={async () => (await copyText(url)) && toast.show("Link disalin ke clipboard")} className="flex flex-col items-center gap-1.5 rounded-[14px] p-2 text-xs font-semibold hover:bg-cream-100">
                <span className="grid size-12 place-items-center rounded-full bg-espresso-600 text-white">
                  <Icon name="link" size={20} />
                </span>
                Salin link
              </button>
              <button onClick={nativeShare} className="flex flex-col items-center gap-1.5 rounded-[14px] p-2 text-xs font-semibold hover:bg-cream-100">
                <span className="grid size-12 place-items-center rounded-full bg-cream-200 text-espresso-600">
                  <Icon name="share" size={20} />
                </span>
                Lainnya
              </button>
            </div>
            <p className="mt-3 truncate rounded-[12px] bg-cream-100 px-3 py-2 text-xs text-ink-500">{url}</p>
          </div>
        </div>
      )}
      {toast.node}
    </>
  );
}
