import { AuthorizationStatus, ProductSource, Role } from "@prisma/client";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/authz";
import { db } from "@/lib/db";
import { PageEditor } from "./page-editor";
import { parsePageConfig } from "@/lib/page-config";

export default async function PageEdit({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor([Role.STORE_ADMIN, Role.PLATFORM_ADMIN]); const { id } = await params;
  const storeId = actor.role === Role.STORE_ADMIN ? actor.storeId : (await cookies()).get("supportStoreId")?.value;
  const page = await db.storePage.findFirst({ where: { id, storeId: storeId ?? "" }, include: { store: true } });
  if (!page) notFound();
  const [categories,products]=await Promise.all([db.category.findMany({where:{storeId:page.storeId,isActive:true},orderBy:{sort:"asc"},select:{id:true,name:true}}),db.product.findMany({where:{storeId:page.storeId,isPublished:true,isDeleted:false,category:{isActive:true},OR:[{source:{not:ProductSource.ENTERPRISE}},{authorization:{status:AuthorizationStatus.ACTIVE}}]},include:{variants:{orderBy:{sort:"asc"}}},orderBy:[{sort:"asc"},{createdAt:"desc"}]})]);
  let card={name:page.store.name,phone:page.store.phone,wechat:null,title:"店铺顾问",bio:page.store.address,avatarUrl:page.store.logoUrl,shareCode:null} as {name:string;phone:string|null;wechat:string|null;title:string|null;bio:string|null;avatarUrl:string|null;shareCode:string|null};try{card={...card,...JSON.parse(page.store.defaultCardJson)}}catch{}
  return <PageEditor page={{ id: page.id, title: page.title, slug: page.slug, config:parsePageConfig(page.draftJson), published: Boolean(page.publishedAt), isHome: page.isHome }} publicUrl={`/s/${page.store.slug}${page.isHome ? "" : `/p/${page.slug}`}`} store={{slug:page.store.slug,name:page.store.name,logoUrl:page.store.logoUrl,phone:page.store.phone,address:page.store.address}} categories={categories} employee={card} products={products.map(product=>({id:product.id,name:product.name,code:product.code,mainImageUrl:product.mainImageUrl,galleryImageUrls:product.galleryImageUrls,detailImageUrls:product.detailImageUrls,specification:product.specification,price:product.price?.toString()??null,unit:product.unit,description:product.description,categoryId:product.categoryId,variants:product.variants.map(variant=>({id:variant.id,name:variant.name,code:variant.code,price:variant.price?.toString()??null,imageUrl:variant.imageUrl,specification:variant.specification}))}))}/>;
}
