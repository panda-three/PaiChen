"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Upload } from "lucide-react";

type Result = { success: number; failed: number; errors: { row: number; code: string; reason: string }[] };

export function ImportClient() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    const file = new FormData(event.currentTarget).get("file");
    try {
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("请选择 .xlsx 文件");
      if (file.size > 20 * 1024 * 1024) throw new Error("Excel 文件不能超过 20MB");
      const signedResponse = await fetch("/api/products/import/upload-url", { method: "POST" });
      const signed = await signedResponse.json().catch(() => null);
      if (!signedResponse.ok) throw new Error(signed?.error ?? "无法创建上传地址");
      const uploadResponse = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: file });
      if (!uploadResponse.ok) throw new Error("Excel 上传失败，请重试");
      const response = await fetch("/api/products/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: signed.path }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "导入失败，请检查文件");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入失败，请检查文件");
    } finally {
      setLoading(false);
    }
  }

  return <div className="grid gap-6">
    <section className="panel p-6"><h2 className="font-bold">1. 下载并填写模板</h2><p className="muted mt-2 text-sm leading-6">每个序号代表一款商品。名称、型号、品名、单位、单价和第一张主图为必填项；尺寸和白底图可留空。</p><a className="btn mt-4" href="/api/products/template"><Download size={16} />下载导入模板</a></section>
    <form onSubmit={submit} className="panel p-6"><h2 className="font-bold">2. 上传 Excel 文件</h2><input className="field mt-4" type="file" name="file" accept=".xlsx" required />{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<button className="btn btn-primary mt-4" disabled={loading}><Upload size={16} />{loading ? "正在校验并导入..." : "开始导入"}</button></form>
    {result && <section className="panel p-6"><h2 className="font-bold">导入结果</h2><div className="mt-4 flex flex-wrap gap-3"><span className="badge">成功 {result.success} 款</span><span className={`badge ${result.failed ? "badge-warn" : ""}`}>失败 {result.failed} 款</span></div>{result.success > 0 && <Link className="btn btn-primary mt-4" href="/admin/products?category=uncategorized"><ArrowRight size={16} />去批量分类</Link>}{result.errors.length > 0 && <div className="table-wrap mt-5"><table><thead><tr><th>行号</th><th>错误码</th><th>失败原因</th></tr></thead><tbody>{result.errors.map((item) => <tr key={`${item.row}-${item.code}-${item.reason}`}><td>{item.row}</td><td>{item.code}</td><td className="text-red-700">{item.reason}</td></tr>)}</tbody></table></div>}</section>}
  </div>;
}
