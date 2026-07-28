"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function StaffRegistration({ invite, storeName, role, maskedPhone, unavailable }: { invite: string; storeName: string; role: string; maskedPhone: string; unavailable: string | null }) {
  const [message, setMessage] = useState(unavailable ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget; const data = new FormData(form);
    const body = { invite, name: data.get("name"), username: data.get("username"), phone: data.get("phone"), password: data.get("password") };
    const response = await fetch("/api/staff-invitations/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "注册失败"); setBusy(false); return; }
    const login = await signIn("credentials", { username: body.username, password: body.password, redirect: false });
    if (login?.error) { setMessage("注册成功，请返回登录页使用新账号登录"); setBusy(false); return; }
    window.location.href = "/me";
  }
  return <><div className="rounded border bg-[#f6f8f6] p-4 text-sm"><p><b>{storeName}</b></p><p>{role} · 邀请手机号 {maskedPhone}</p></div><form className="auth-form" onSubmit={submit}><label className="label">姓名<input className="field" name="name" maxLength={50} autoComplete="name" required/></label><label className="label">独立登录账号<input className="field" name="username" minLength={3} maxLength={50} autoComplete="username" required/></label><label className="label">邀请手机号<input className="field" name="phone" inputMode="numeric" pattern="1[0-9]{10}" autoComplete="tel" required/></label><label className="label">密码<input className="field" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required/></label><button className="btn btn-primary" disabled={busy||Boolean(unavailable)}>注册并进入 APP</button>{message&&<p className="auth-feedback" role="status">{message}</p>}</form></>;
}
