"use client";
import { useState } from "react";
import { Icon } from "../Icon";

export function LoginForm() {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) window.location.reload();
    else setErr(j.error || "Gagal masuk");
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-10 w-full max-w-sm space-y-4 rounded-[26px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[14px] bg-espresso-600 text-white">
          <Icon name="lock" size={20} />
        </span>
        <div>
          <h1 className="text-lg font-extrabold">Admin Nongki</h1>
          <p className="text-xs text-ink-500">Masukkan password admin</p>
        </div>
      </div>
      <label className="flex h-12 items-center gap-2 rounded-[14px] border border-line px-3 focus-within:border-espresso-600">
        <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password" className="w-full bg-transparent text-sm outline-none" aria-label="Password admin" required />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan" : "Tampilkan"} className="text-espresso-600">
          <Icon name={show ? "eyeoff" : "eye"} size={18} />
        </button>
      </label>
      {err && <p className="text-sm font-semibold text-slow-600">{err}</p>}
      <button disabled={busy} className="h-12 w-full rounded-[14px] bg-espresso-600 font-semibold text-white disabled:opacity-50">
        {busy ? "Masuk…" : "Masuk"}
      </button>
    </form>
  );
}

export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.href = "/admin";
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-500 hover:text-espresso-600"
    >
      <Icon name="logout" size={14} /> Keluar
    </button>
  );
}
