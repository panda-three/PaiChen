"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Camera, ChevronLeft, LockKeyhole, LogOut, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type Profile = {
  id: string; storeSlug: string; storeName: string; name: string; phone: string;
  avatarUrl: string | null;
};
type DeviceSession = { id: string; userAgent: string; createdAt: string; lastActiveAt: string; expiresAt: string; current: boolean };

export function CustomerSettings({ loginPhone, profile: initialProfile, refCode }: { loginPhone: string; profile: Profile; refCode: string }) {
  const [profile, setProfile] = useState(initialProfile);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/customer/sessions").then((response) => response.json()).then((data) => setDevices(data.sessions ?? [])); }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/customer/settings/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      storeSlug: profile.storeSlug, name: data.get("name"), phone: data.get("phone"), currentPassword: data.get("currentPassword") || undefined,
    }) });
    const result = await response.json();
    if (response.ok) { setProfile((current) => ({ ...current, ...result.profile })); setMessage("资料已保存"); } else setMessage(result.error ?? "保存失败");
    setBusy(false);
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch("/api/customer/settings/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) });
    const result = await response.json(); setMessage(response.ok ? "密码已更新" : result.error ?? "修改失败");
    if (response.ok) form.reset(); setBusy(false);
  }

  async function upload(file: File | undefined) {
    if (!file) return; setBusy(true); setMessage("");
    const body = new FormData(); body.set("storeSlug", profile.storeSlug); body.set("type", "avatar"); body.set("file", file);
    const response = await fetch("/api/customer/settings/assets", { method: "POST", body }); const result = await response.json();
    if (response.ok) setProfile((current) => ({ ...current, avatarUrl: result.url }));
    setMessage(response.ok ? "图片已更新" : result.error ?? "上传失败"); setBusy(false);
  }

  async function removeAvatar() {
    setBusy(true); const response = await fetch("/api/customer/settings/assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeSlug: profile.storeSlug, type: "avatar" }) }); const result = await response.json();
    if (response.ok) setProfile((current) => ({ ...current, avatarUrl: null }));
    setMessage(response.ok ? "图片已移除" : result.error ?? "移除失败"); setBusy(false);
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/customer/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "下线失败"); return; }
    if (result.current) { await signOut({ callbackUrl: "/login" }); return; }
    setDevices((current) => current.filter((item) => item.id !== id)); setMessage("设备已下线");
  }

  const meParams = new URLSearchParams({ store: profile.storeSlug }); if (refCode) meParams.set("ref", refCode);
  return <div className="public-desktop"><main className="public-phone public-settings">
    <header><Link href={`/me?${meParams}`} aria-label="返回我的"><ChevronLeft/></Link><div><h1>账号设置</h1><p>{profile.storeName} · 资料仅用于当前店铺</p></div></header>
    <section className="settings-identity"><div className="settings-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="个人头像"/> : <UserRound/>}<label title="上传头像"><Camera/><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])}/></label></div><div><strong>{profile.name}</strong><span>全局登录手机号 {loginPhone}</span>{profile.avatarUrl && <button type="button" disabled={busy} onClick={() => void removeAvatar()}>移除头像</button>}</div></section>
    {message && <p className="settings-message" role="status">{message}</p>}
    <form className="settings-card settings-form" onSubmit={saveProfile}><h2><UserRound/> 个人资料</h2><label>昵称<input name="name" defaultValue={profile.name} maxLength={50} required/></label><label>本店联系电话<input name="phone" defaultValue={profile.phone} pattern="1[0-9]{10}" required/></label><label>当前密码 <small>仅在修改本店联系电话时必填</small><input name="currentPassword" type="password" autoComplete="current-password"/></label><button disabled={busy}>保存当前店资料</button></form>
    <form className="settings-card settings-form" onSubmit={changePassword}><h2><LockKeyhole/> 安全设置</h2><p><ShieldCheck/> 密码对所有店铺全局生效</p><label>当前密码<input name="currentPassword" type="password" autoComplete="current-password" required/></label><label>新密码<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required/></label><button disabled={busy}>修改密码</button></form>
    <section className="settings-card"><h2><Smartphone/> 登录设备</h2>{devices.map((device) => <article className="settings-device" key={device.id}><Smartphone/><div><strong>{device.current ? "当前设备" : "登录设备"}</strong><span>{device.userAgent}</span><small>最近活跃 {new Date(device.lastActiveAt).toLocaleString("zh-CN")}</small></div><button type="button" onClick={() => void revoke(device.id)}>{device.current ? "退出" : "下线"}</button></article>)}{!devices.length && <div className="public-empty">暂无有效设备</div>}</section>
    <button className="settings-signout" type="button" onClick={() => { const current = devices.find((item) => item.current); if (current) void revoke(current.id); else void signOut({ callbackUrl: "/login" }); }}><LogOut/> 退出登录</button>
  </main></div>;
}
