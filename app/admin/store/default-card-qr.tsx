"use client";

import { useState } from "react";

export function DefaultCardQr({ initialUrl, wechatConfigured }: { initialUrl: string | null; wechatConfigured: boolean }) {
  const [url, setUrl] = useState(initialUrl); const complete = wechatConfigured && Boolean(url); const [message, setMessage] = useState(complete ? "名片完整，商城会展示微信入口" : "待补齐：微信号和二维码完整后才展示微信入口"); const [busy, setBusy] = useState(false);
  async function upload(file?: File) { if (!file) return; setBusy(true); const body = new FormData(); body.set("file", file); const response = await fetch("/api/store/settings/assets", { method: "POST", body }); const result = await response.json(); if (response.ok) setUrl(result.url); setMessage(response.ok ? "二维码已更新，请确认微信号后保存资料" : result.error ?? "上传失败"); setBusy(false); }
  async function remove() { setBusy(true); const response = await fetch("/api/store/settings/assets", { method: "DELETE" }); if (response.ok) setUrl(null); setMessage(response.ok ? "二维码已删除，微信入口已隐藏" : "删除失败"); setBusy(false); }
  return <section className="mt-5 rounded border border-[#e5e9e6] p-4"><div className="flex items-center justify-between gap-3"><div><strong>默认名片微信二维码</strong><p className="muted mt-1 text-xs" role="status">{message}</p></div><span className={`badge ${complete ? "" : "badge-warn"}`}>{complete ? "完整" : "待补齐"}</span></div>{url && <img className="mt-4 size-40 object-contain" src={url} alt="默认名片微信二维码"/>}<div className="actions mt-4"><label className="btn">{url ? "替换二维码" : "上传二维码"}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])}/></label>{url && <button className="btn btn-danger" type="button" disabled={busy} onClick={() => void remove()}>删除二维码</button>}</div></section>;
}
