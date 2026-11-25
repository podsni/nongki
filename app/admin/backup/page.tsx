import Link from "next/link";
import { BackupPanel } from "@/components/admin/BackupPanel";
import { Icon } from "@/components/Icon";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdmin } from "@/lib/auth";
import { countsOf, KEEP_AUTO, listSnapshots, MAX_BYTES } from "@/lib/backup";
import { loadDB, storageMode } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backup · Admin", robots: { index: false } };

export default async function BackupPage() {
  if (!(await isAdmin())) return <LoginForm />;
  const [db, snapshots] = await Promise.all([loadDB(), listSnapshots().catch(() => [])]);
  return (
    <main className="space-y-5 pb-24 md:pb-6">
      <div>
        <Link href="/admin" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-ink-500 hover:text-espresso-600">
          <Icon name="back" size={16} /> Kelola tempat
        </Link>
        <h1 className="text-2xl font-extrabold">Backup &amp; pemulihan</h1>
        <p className="text-sm text-ink-500">Ekspor semua data, impor dari file, dan pulihkan snapshot. Penyimpanan: {storageMode() === "blob" ? "Vercel Blob (private)" : "file lokal"}.</p>
      </div>
      <BackupPanel counts={countsOf(db)} initial={snapshots} maxBytes={MAX_BYTES} keepAuto={KEEP_AUTO} />
    </main>
  );
}
