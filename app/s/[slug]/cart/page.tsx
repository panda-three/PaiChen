import { getPublicCatalog } from "@/lib/public-catalog";
import { PublicCartPage } from "./public-cart-page";

export default async function CartPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }) { const [{ slug }, { ref }] = await Promise.all([params, searchParams]); const catalog = await getPublicCatalog(slug); return <PublicCartPage catalog={catalog} refCode={ref}/>; }
