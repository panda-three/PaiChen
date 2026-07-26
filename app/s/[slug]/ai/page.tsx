import { Sparkles, WandSparkles } from "lucide-react";
import { getPublicStore } from "@/lib/public-catalog";

export default async function AiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; await getPublicStore(slug);
  return <main className="public-ai"><header><Sparkles/><small>YUNCHENG AI SPACE</small><h1>用灵感，预见理想空间</h1><p>AI 空间搭配与智能选品正在准备中</p></header><section><WandSparkles/><h2>AI 灵感设计</h2><p>上传空间照片，探索与你家契合的家具搭配。</p><button disabled>敬请期待</button></section><section><Sparkles/><h2>智能选品顾问</h2><p>结合户型、风格与预算，给出更适合你的选品建议。</p><button disabled>敬请期待</button></section></main>;
}
