import { Role } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { requireActor } from "@/lib/authz";
import { PageHeader, FormError } from "@/components/page-header";
import { saveStoreProfile } from "../actions";

export default async function StoreProfilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN]);
  const query = await searchParams;
  const store = actor.store!;
  return <>
    <PageHeader title="店铺资料" description="已保存的信息会立即用于 H5 店铺页和订单导出" actions={<Link className="btn" href={`/s/${store.slug}`} target="_blank"><ExternalLink size={16} />查看 H5</Link>} />
    <FormError message={query.error} />
    <form action={saveStoreProfile} className="panel max-w-4xl p-6">
      <div className="form-grid">
        <label className="label">店铺名称<input className="field" name="name" required defaultValue={store.name} /></label>
        <label className="label">联系电话<input className="field" name="phone" required defaultValue={store.phone} /></label>
        <label className="label col-span-full">Logo 图片 URL<input className="field" name="logoUrl" type="url" defaultValue={store.logoUrl ?? ""} placeholder="https://..." /></label>
        <label className="label col-span-full">店铺地址<input className="field" name="address" required defaultValue={store.address} /></label>
      </div>
      {store.logoUrl && <div className="mt-5"><p className="label mb-2">当前图片</p><img src={store.logoUrl} alt="店铺 Logo" className="h-32 w-52 rounded object-cover" /></div>}
      <button className="btn btn-primary mt-6">保存资料</button>
    </form>
  </>;
}
