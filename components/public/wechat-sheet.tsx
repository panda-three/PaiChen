"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea"); input.value = value; input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove();
}

export function WechatSheet({ name, wechat, qrUrl, onClose }: { name: string; wechat: string; qrUrl: string; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null); const close = useRef<HTMLButtonElement>(null); const [copied, setCopied] = useState(false);
  useEffect(() => { close.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const focusable = dialog.current?.querySelectorAll<HTMLElement>("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])"); if (!focusable?.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }; document.addEventListener("keydown", key); const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; }; }, [onClose]);
  return <div className="wechat-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialog} className="wechat-sheet" role="dialog" aria-modal="true" aria-labelledby="wechat-sheet-title"><button ref={close} className="wechat-sheet-close" type="button" aria-label="关闭微信名片" onClick={onClose}><X size={20}/></button><p>添加顾问微信</p><h2 id="wechat-sheet-title">{name}</h2><div className="wechat-sheet-id"><span>微信号 <b>{wechat}</b></span><button type="button" onClick={() => void copyText(wechat).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); })}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "已复制" : "复制"}</button></div><img src={qrUrl} alt={`${name}的微信二维码`}/><small>长按识别或保存二维码，再到微信中添加</small></section></div>;
}
