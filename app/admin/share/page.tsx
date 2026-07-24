import { Role } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { CopyLink } from "@/components/copy-link";
import { saveMyCard } from "../actions";

export default async function SharePage(){const actor=await requireActor([Role.EMPLOYEE]);const employee=await db.user.findUnique({where:{id:actor.id},include:{store:true}});if(!employee?.store)return null;const path=`/s/${employee.store.slug}?ref=${employee.shareCode}`;return <><PageHeader title="我的分享与名片" description="有效员工来源优先展示；停用后自动回退店铺默认名片" actions={<Link className="btn" href={path} target="_blank"><ExternalLink size={16}/>打开 H5</Link>}/><div className="grid gap-5 lg:grid-cols-2"><section className="panel p-6"><div className="flex items-center gap-4"><img src={employee.avatarUrl??employee.store.logoUrl??""} alt="" className="size-16 rounded-full object-cover"/><div><h2 className="font-bold">{employee.name}</h2><p className="muted text-sm">{employee.title??"员工顾问"}</p></div></div><code className="mt-5 block break-all rounded bg-[#f4f6f4] p-3 text-sm">{path}</code><CopyLink path={path}/></section><form action={saveMyCard} className="panel grid gap-3 p-6"><h2 className="font-bold">维护个人名片</h2><input className="field" name="name" defaultValue={employee.name} placeholder="姓名" required/><input className="field" name="phone" defaultValue={employee.phone??""} placeholder="电话" required/><input className="field" name="wechat" defaultValue={employee.wechat??""} placeholder="微信"/><input className="field" name="title" defaultValue={employee.title??""} placeholder="职位"/><input className="field" name="bio" defaultValue={employee.bio??""} placeholder="名片文案"/><input className="field" name="avatarUrl" type="url" defaultValue={employee.avatarUrl??""} placeholder="头像 URL"/><button className="btn btn-primary">保存名片</button></form></div></>}
