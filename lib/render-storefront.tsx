import { AuthorizationStatus, ProductSource, Role } from "@prisma/client";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Storefront } from "@/app/s/[slug]/storefront";
import { parsePageConfig } from "@/lib/page-config";
import { canAccessPublicStore } from "@/lib/deployment-scope";

export async function renderStorefront(slug:string,pageSlug:string|undefined,ref:string|undefined){
  if(!canAccessPublicStore(slug))notFound();
  const store=await db.store.findUnique({where:{slug}});if(!store)notFound();if(!store.isActive)return <main className="grid min-h-screen place-items-center"><h1>店铺暂不可用</h1></main>;
  const session=await auth();const customerId=session?.user?.role===Role.CUSTOMER?session.user.id:null;
  const [categories,products,employee,page,favorites]=await Promise.all([
    db.category.findMany({where:{storeId:store.id,isActive:true},orderBy:{sort:"asc"},select:{id:true,name:true}}),
    db.product.findMany({where:{storeId:store.id,isPublished:true,isDeleted:false,category:{isActive:true},OR:[{source:{not:ProductSource.ENTERPRISE}},{authorization:{status:AuthorizationStatus.ACTIVE}}]},include:{variants:{orderBy:{sort:"asc"}}},orderBy:[{sort:"asc"},{createdAt:"desc"}]}),
    ref?db.user.findFirst({where:{storeId:store.id,shareCode:ref,role:Role.EMPLOYEE,isActive:true},select:{name:true,phone:true,wechat:true,title:true,bio:true,avatarUrl:true,shareCode:true}}):null,
    pageSlug?db.storePage.findFirst({where:{storeId:store.id,slug:pageSlug,publishedAt:{not:null}}}):db.storePage.findFirst({where:{storeId:store.id,isHome:true,publishedAt:{not:null}}}),
    customerId?db.favorite.findMany({where:{storeId:store.id,customerId},select:{productId:true}}):[],
  ]);if(!page?.publishedJson)notFound();let defaultCard={name:store.name,phone:store.phone,wechat:null,title:"店铺顾问",bio:store.address,avatarUrl:store.logoUrl,shareCode:null} as {name:string;phone:string|null;wechat:string|null;title:string|null;bio:string|null;avatarUrl:string|null;shareCode:string|null};try{defaultCard={...defaultCard,...JSON.parse(store.defaultCardJson)}}catch{}const card=employee??defaultCard;return <Storefront store={store} categories={categories} employee={card} products={products.map(p=>({...p,price:p.price?.toString()??null,variants:p.variants.map(v=>({...v,price:v.price?.toString()??null}))}))} pageConfig={parsePageConfig(page.publishedJson)} pageSlug={page.slug} customerActive={Boolean(customerId)} favoriteIds={favorites.map(x=>x.productId)}/>;
}
