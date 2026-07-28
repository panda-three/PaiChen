import Link from "next/link";
import { Role } from "@prisma/client";
import { Contact, Settings, Share2, Store, UserRound } from "lucide-react";
import { CopyLink } from "@/components/copy-link";

export function StaffCenter({ user }: { user: { username: string; role: Role; name: string; phone: string | null; wechat: string | null; title: string | null; bio: string | null; avatarUrl: string | null; shareCode: string | null; store: { name: string; slug: string } } }) {
  const sharePath = `/s/${user.store.slug}?ref=${encodeURIComponent(user.shareCode ?? "")}`;
  return <div className="public-desktop"><main className="public-phone public-me"><header>{user.avatarUrl?<img className="public-avatar-image" src={user.avatarUrl} alt="名片头像"/>:<div className="public-avatar"><UserRound/></div>}<div><h1>{user.name}</h1><p>{user.role===Role.STORE_ADMIN?"店铺管理员":"员工"} · {user.username}</p></div></header><nav className="public-me-summary"><Link href="/me/settings"><Settings/><b>名片</b><span>设置</span></Link><Link href={sharePath}><Share2/><b>我的</b><span>分享页</span></Link></nav><section><h2><Store/> 所属店铺</h2><div className="public-profile"><span>{user.store.name}</span><small>账号已启用</small></div></section><section><h2><Contact/> 名片预览</h2><article className="public-order"><header><b>{user.title||"店铺顾问"}</b><span>{user.name}</span></header><p>{user.bio||"暂未填写简介"}</p><small>{user.phone||"未填写电话"} · 微信 {user.wechat||"未填写"}</small></article><div className="mt-4"><CopyLink path={sharePath}/></div></section><Link className="public-back-store" href={sharePath}>查看我的名片</Link></main></div>;
}
