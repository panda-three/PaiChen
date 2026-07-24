"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      username: data.get("username"), password: data.get("password"), redirect: false,
    });
    if (result?.error) {
      setError("账号或密码错误，或账号已被停用");
      setLoading(false);
      return;
    }
    window.location.href = "/admin";
  }

  return <form onSubmit={submit} className="grid gap-4">
    <label className="label">登录账号<input className="field" name="username" autoComplete="username" defaultValue="store_a_admin" /></label>
    <label className="label">密码<input className="field" name="password" type="password" autoComplete="current-password" defaultValue="Demo123!" /></label>
    {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <button className="btn btn-primary mt-1" disabled={loading}><LogIn size={17} />{loading ? "登录中..." : "登录后台"}</button>
  </form>;
}
