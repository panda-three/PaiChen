import { renderStorefront } from "@/lib/render-storefront";
export default async function StorefrontPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{ref?:string}>}){const {slug}=await params;const {ref}=await searchParams;return renderStorefront(slug,undefined,ref);}
