import { requireActor } from "@/lib/authz";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return <AdminShell actor={actor}>{children}</AdminShell>;
}
