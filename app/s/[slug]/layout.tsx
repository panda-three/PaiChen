import { PublicCartProvider } from "@/components/public/cart-provider";
import { MobileShell } from "@/components/public/mobile-shell";

export default async function PublicStoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicCartProvider slug={slug}><MobileShell slug={slug}>{children}</MobileShell></PublicCartProvider>;
}
