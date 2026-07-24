import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/authz";

export default async function AdminHome() {
  const actor = await requireActor();
  redirect(actor.role === Role.PLATFORM_ADMIN ? "/admin/stores" : actor.role === Role.STORE_ADMIN ? "/admin/orders" : "/admin/share");
}
