import { Role } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { CopyLink } from "@/components/copy-link";

export default async function SharePage() {
  const actor = await requireActor([Role.EMPLOYEE]);
  const employee = await db.user.findUnique({ where: { id: actor.id }, include: { store: true } });
  return <><PageHeader title="我的分享" description="客户通过此链接进入店铺后，订单会记录为你的来源" actions={<Link className="btn" href={`/s/${employee!.store!.slug}?ref=${employee!.shareCode}`} target="_blank"><ExternalLink size={16} />打开 H5</Link>} /><section className="panel max-w-2xl p-6"><div className="flex items-center gap-4 border-b border-[#e8ece9] pb-5"><img src={employee?.avatarUrl ?? employee?.store?.logoUrl ?? ""} alt="" className="size-16 rounded-full object-cover" /><div><h2 className="text-lg font-bold">{employee?.name}</h2><p className="muted mt-1 text-sm">{employee?.title ?? "员工顾问"}</p></div></div><p className="muted mt-5 text-sm">分享链接</p><code className="mt-2 block break-all rounded bg-[#f4f6f4] p-3 text-sm">/s/{employee!.store!.slug}?ref={employee!.shareCode}</code><CopyLink path={`/s/${employee!.store!.slug}?ref=${employee!.shareCode}`} /></section></>;
}
