"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, Share2, Trash2, X } from "lucide-react";
import QRCode from "qrcode";
import { deletePage, duplicatePage } from "../phase-one-actions";

type PageManagementActionsProps = {
  id: string;
  title: string;
  isHome: boolean;
  published: boolean;
  storeName: string;
  storeLogoUrl: string | null;
  pagePath: string;
};

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function fitFont(context: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, minimumSize: number, weight = 700) {
  let size = initialSize;
  do {
    context.font = `${weight} ${size}px Arial, "PingFang SC", "Microsoft YaHei", sans-serif`;
    if (context.measureText(text).width <= maxWidth) return;
    size -= 2;
  } while (size >= minimumSize);
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number) {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, x - (width - size) / 2, y - (height - size) / 2, width, height);
}

async function createPoster(input: { url: string; storeName: string; storeLogoUrl: string | null; pageTitle: string }) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法生成海报");

  const qrSource = await QRCode.toDataURL(input.url, { width: 420, margin: 2, errorCorrectionLevel: "M", color: { dark: "#17211b", light: "#ffffff" } });
  const [qrImage, logoImage] = await Promise.all([
    loadImage(qrSource),
    input.storeLogoUrl ? loadImage(input.storeLogoUrl).catch(() => null) : Promise.resolve(null),
  ]);

  const background = context.createLinearGradient(0, 0, 720, 1280);
  background.addColorStop(0, "#0f4f33");
  background.addColorStop(0.38, "#176b45");
  background.addColorStop(1, "#f2eadc");
  context.fillStyle = background;
  context.fillRect(0, 0, 720, 1280);

  context.fillStyle = "rgba(255,255,255,.08)";
  context.beginPath();
  context.arc(650, 80, 220, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(40, 520, 170, 0, Math.PI * 2);
  context.fill();

  const logoX = 72;
  const logoY = 76;
  const logoSize = 112;
  roundedRect(context, logoX, logoY, logoSize, logoSize, 24);
  context.fillStyle = "#ffffff";
  context.fill();
  context.save();
  roundedRect(context, logoX + 6, logoY + 6, logoSize - 12, logoSize - 12, 19);
  context.clip();
  if (logoImage) {
    drawCoverImage(context, logoImage, logoX + 6, logoY + 6, logoSize - 12);
  } else {
    context.fillStyle = "#e5efe9";
    context.fillRect(logoX + 6, logoY + 6, logoSize - 12, logoSize - 12);
    context.fillStyle = "#176b45";
    context.font = '700 48px Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(input.storeName.trim().slice(0, 1) || "店", logoX + logoSize / 2, logoY + logoSize / 2 + 2);
  }
  context.restore();

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#ffffff";
  fitFont(context, input.storeName, 450, 42, 28);
  context.fillText(input.storeName, 214, 132);
  context.fillStyle = "rgba(255,255,255,.7)";
  context.font = '500 22px Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  context.fillText("精选好物 · 欢迎浏览店铺 H5", 214, 174);

  context.fillStyle = "#ffffff";
  roundedRect(context, 54, 262, 612, 912, 30);
  context.fill();

  context.fillStyle = "#17211b";
  fitFont(context, input.pageTitle, 500, 52, 32);
  context.textAlign = "center";
  context.fillText(input.pageTitle, 360, 370);
  context.fillStyle = "#69736c";
  context.font = '400 24px Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  context.fillText("发现适合你的家居好物", 360, 416);

  context.fillStyle = "#edf3ef";
  roundedRect(context, 132, 484, 456, 456, 24);
  context.fill();
  context.drawImage(qrImage, 164, 516, 392, 392);

  context.fillStyle = "#17211b";
  context.font = '700 28px Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  context.fillText("扫码打开 H5 页面", 360, 1010);
  context.fillStyle = "#69736c";
  context.font = '400 18px Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  fitFont(context, input.url, 520, 18, 12, 400);
  context.fillText(input.url, 360, 1052);

  context.fillStyle = "rgba(255,255,255,.8)";
  context.font = '500 18px Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
  context.fillText("长按保存海报 · 分享给好友", 360, 1232);
  return canvas.toDataURL("image/png", 0.95);
}

export function PageManagementActions(props: PageManagementActionsProps) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const url = `${window.location.origin}${props.pagePath}`;
    let active = true;
    setShareUrl(url);
    setPosterUrl("");
    setError("");
    createPoster({ url, storeName: props.storeName, storeLogoUrl: props.storeLogoUrl, pageTitle: props.title })
      .then((result) => active && setPosterUrl(result))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "海报生成失败"));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, props.pagePath, props.storeName, props.storeLogoUrl, props.title]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("复制失败，请手动选择链接复制");
    }
  }

  function downloadPoster() {
    if (!posterUrl) return;
    const link = document.createElement("a");
    link.href = posterUrl;
    link.download = `${props.storeName}-${props.title}-H5海报.png`.replace(/[\\/:*?"<>|]/g, "-");
    link.click();
  }

  return <>
    <form action={duplicatePage}>
      <input type="hidden" name="id" value={props.id}/>
      <button className="btn min-h-8 px-2 text-xs"><Copy size={14}/>复制</button>
    </form>
    <form action={deletePage} onSubmit={(event) => {
      if (!window.confirm(`确定删除“${props.title}”吗？删除后无法恢复。`)) event.preventDefault();
    }}>
      <input type="hidden" name="id" value={props.id}/>
      <button className="btn btn-danger min-h-8 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-45" disabled={props.isHome} title={props.isHome ? "当前主页不能删除，请先设置其他主页" : "删除页面"}><Trash2 size={14}/>删除</button>
    </form>
    <button type="button" className="btn min-h-8 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-45" disabled={!props.published} title={props.published ? "分享 H5" : "发布后可分享"} onClick={() => setOpen(true)}><Share2 size={14}/>分享</button>

    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby={`share-title-${props.id}`} className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#e3e8e4] px-5 py-4">
          <div><h2 id={`share-title-${props.id}`} className="font-bold">分享 H5</h2><p className="muted mt-1 text-xs">生成当前已发布页面的系统海报</p></div>
          <button type="button" className="rounded p-2 hover:bg-[#f1f4f2]" onClick={() => setOpen(false)} aria-label="关闭分享弹窗"><X size={20}/></button>
        </header>
        <div className="grid lg:grid-cols-[150px_minmax(280px,380px)_1fr]">
          <nav className="border-b border-[#e3e8e4] p-5 lg:border-r lg:border-b-0">
            <p className="muted mb-3 text-xs">渠道</p>
            <div className="rounded bg-[#edf3ef] px-3 py-2 text-sm font-bold text-[#176b45]">H5 页面</div>
          </nav>
          <div className="grid min-h-[540px] place-items-center bg-[#f5f7f5] p-6">
            {posterUrl ? <img src={posterUrl} alt={`${props.title}分享海报`} className="max-h-[64vh] rounded shadow-lg"/> : <div className="muted text-sm">{error || "正在生成海报…"}</div>}
          </div>
          <div className="p-6">
            <p className="text-xs font-bold tracking-wider text-[#176b45]">系统海报</p>
            <h3 className="mt-2 text-xl font-bold">{props.title}</h3>
            <p className="muted mt-2 text-sm leading-6">海报包含店铺信息、页面名称和可扫码访问的二维码。</p>
            <label className="mt-6 block text-xs font-bold text-[#465149]" htmlFor={`share-url-${props.id}`}>H5 链接</label>
            <textarea id={`share-url-${props.id}`} className="field mt-2 min-h-24 resize-none text-xs" readOnly value={shareUrl}/>
            {error && posterUrl && <p className="mt-2 text-xs text-[#b83931]">{error}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button type="button" className="btn" onClick={copyLink}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "已复制" : "复制链接"}</button>
              <button type="button" className="btn btn-primary" disabled={!posterUrl} onClick={downloadPoster}><Download size={16}/>下载海报</button>
              <a className="btn sm:col-span-2 lg:col-span-1 xl:col-span-2" href={props.pagePath} target="_blank" rel="noreferrer"><ExternalLink size={16}/>打开 H5</a>
            </div>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
