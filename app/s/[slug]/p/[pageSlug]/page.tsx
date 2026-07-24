import { renderStorefront } from "@/lib/render-storefront";
export default async function CustomPage({params,searchParams}:{params:Promise<{slug:string;pageSlug:string}>;searchParams:Promise<{ref?:string}>}){const {slug,pageSlug}=await params;const {ref}=await searchParams;return renderStorefront(slug,pageSlug,ref);}
