import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "云丞 AI 商城",
  description: "店铺商品展示与意向开单平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
