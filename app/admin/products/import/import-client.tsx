"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";

type Result = { success: number; failed: number; errors: { row: number; reason: string }[] };

export function ImportClient() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    const response = await fetch("/api/products/import", { method: "POST", body: new FormData(event.currentTarget) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setError(payload?.error ?? "导入失败，请检查文件"); else setResult(payload);
    setLoading(false);
  }

  return <div className="grid gap-6">
    <section className="panel p-6"><h2 className="font-bold">1. 下载并填写模板</h2><p className="muted mt-2 text-sm leading-6">不要修改表头。分类名称必须已存在；图片仅支持可访问的 HTTP/HTTPS URL；详情图每行一个 URL。</p><a className="btn mt-4" href="/api/products/template"><Download size={16} />下载导入模板</a></section>
    <form onSubmit={submit} className="panel p-6"><h2 className="font-bold">2. 上传 Excel 文件</h2><input className="field mt-4" type="file" name="file" accept=".xlsx" required />{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<button className="btn btn-primary mt-4" disabled={loading}><Upload size={16} />{loading ? "正在校验并导入..." : "开始导入"}</button></form>
    {result && <section className="panel p-6"><h2 className="font-bold">导入结果</h2><div className="mt-4 flex gap-3"><span className="badge">成功 {result.success} 条</span><span className={`badge ${result.failed ? "badge-warn" : ""}`}>失败 {result.failed} 条</span></div>{result.errors.length > 0 && <div className="table-wrap mt-5"><table><thead><tr><th>行号</th><th>失败原因</th></tr></thead><tbody>{result.errors.map((item) => <tr key={`${item.row}-${item.reason}`}><td>{item.row}</td><td className="text-red-700">{item.reason}</td></tr>)}</tbody></table></div>}</section>}
  </div>;
}
