import Link from "next/link";
import { LoginForm } from "@/components/admin/LoginForm";
import { ImportFlow } from "@/components/admin/ImportFlow";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await isAdmin())) return <LoginForm />;
  return (
    <main className="space-y-4">
      <Link href="/admin" className="text-sm font-semibold text-ink-500">← Kembali</Link>
      <ImportFlow />
    </main>
  );
}
