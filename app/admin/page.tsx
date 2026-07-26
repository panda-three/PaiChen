import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/authz";

export default async function AdminHome() {
  const actor = await requireActor();
  redirect(actor.role === Role.PLATFORM_ADMIN ? "/admin/organizations" : actor.role === Role.ENTERPRISE_ADMIN ? "/admin/enterprise" : "/admin/dashboard");
}
