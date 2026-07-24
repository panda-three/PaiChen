"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ path, compact = false }: { path: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setDone(true); setTimeout(() => setDone(false), 1600);
  }
  return <button type="button" className={`btn ${compact ? "min-h-8 px-2 text-xs" : ""}`} onClick={copy}>{done ? <Check size={15} /> : <Copy size={15} />}{done ? "已复制" : "复制链接"}</button>;
}
