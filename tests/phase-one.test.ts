import { describe,expect,it } from "vitest";
import { Role } from "@prisma/client";
import { lastValidAttribution } from "../lib/attribution";
import { groupImportRows,ImportRow } from "../lib/product-import";
import { isIntentCustomer,parsePageConfig,sanitizeRichText } from "../lib/validation";
import { resolveImageAdHref, validatePageConfigForStore } from "../lib/page-config";
import { canUploadPageAsset, PAGE_ASSET_MAX_SIZE, PAGE_ASSET_MIME_TYPES } from "../lib/page-assets";
import { insertPageComponent,movePageComponent,removePageComponent } from "../lib/page-editor-state";
import { buildPageCopyData,publicPagePath } from "../lib/page-management";
import { canOperateStore,orderScope } from "../lib/scopes";
import { canAccessPublicStore } from "../lib/deployment-scope";
import { normalizeCart,updateCart } from "../lib/public-cart";
import { customerHref,storeHref } from "../lib/public-links";
import { defaultPublicStoreSlug,validatePreviewStoreSlug } from "../lib/server-env";
import { runtimeDatabaseUrl } from "../lib/db";
import { LIANGCHEN_CONTENT_PAGES, liangchenHomeConfig, missingLiangchenContentPages } from "../lib/liangchen-template";
import { productNameWithCode, resolveProductGroup } from "../lib/product-group";
import { scrollCarouselTo } from "../lib/carousel";

describe("page config",()=>{
  it("upgrades V1 and strips executable rich text",()=>{const config=parsePageConfig({version:1,components:[{id:"a",type:"richText",html:'<p onclick="bad()">安全</p><script>alert(1)</script>'},{id:"p",type:"products",title:"商品",productIds:["p1"]}]});expect(config.version).toBe(4);expect(config.components.map(x=>x.type)).toEqual(["storeHeader","employeeCard","richText","productGrid"]);expect(config.components.find(x=>x.type==="richText")).toMatchObject({html:"<p>安全</p>"});expect(config.components.find(x=>x.type==="productGrid")).toMatchObject({source:{mode:"selected",productIds:["p1"]}})});
  it("upgrades V2 and V3 to V4 and converts legacy image ads",()=>{const config=parsePageConfig({version:3,themeColor:"#123456",components:[{id:"ad",type:"image",url:"https://example.com/a.jpg",alt:"活动",link:"/sale"},{id:"p",type:"productGrid",title:"精选",source:{mode:"all"}}]});expect(config).toMatchObject({version:4,themeColor:"#123456"});expect(config.components[0]).toMatchObject({type:"imageAd",items:[{imageUrl:"https://example.com/a.jpg",target:{type:"custom",url:"/sale"}}]})});
  it("rejects unknown component types",()=>expect(()=>parsePageConfig({version:1,components:[{id:"x",type:"payment"}]})).toThrow());
  it("blocks javascript URLs",()=>expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:"));
  it("rejects cross-store product and category references",()=>{const available={productIds:new Set(["own-product"]),categoryIds:new Set(["own-category"])};expect(()=>validatePageConfigForStore(parsePageConfig({version:2,components:[{id:"x",type:"productGrid",title:"x",source:{mode:"selected",productIds:["other-product"]}}]}),available)).toThrow("商品不属于当前店铺");expect(()=>validatePageConfigForStore(parsePageConfig({version:2,components:[{id:"x",type:"productGrid",title:"x",source:{mode:"category",categoryId:"other-category"}}]}),available)).toThrow("商品分类不属于当前店铺")});
  it("keeps page-level store header overrides within the current store",()=>{const config=parsePageConfig({version:3,themeColor:"#5f4939",components:[{id:"header",type:"storeHeader",style:"compact",subtitle:"活动专享",name:"夏季展厅",imageSource:{type:"productMainImage",productId:"own-product"}}]});expect(config.components[0]).toMatchObject({name:"夏季展厅",imageSource:{type:"productMainImage",productId:"own-product"}});expect(()=>validatePageConfigForStore(config,{productIds:new Set(),categoryIds:new Set()})).toThrow("店铺头部图片不属于当前店铺")});
  it("requires a product grid on homepages",()=>{const config=parsePageConfig({version:2,components:[{id:"h",type:"storeHeader",style:"compact",subtitle:"x"},{id:"c",type:"employeeCard",style:"dark"}]});expect(()=>validatePageConfigForStore(config,{productIds:new Set(),categoryIds:new Set()},true)).toThrow("主页必须包含")});
  it("enforces image and group limits and safe custom protocols",()=>{expect(()=>parsePageConfig({version:4,themeColor:"#123456",components:[{id:"a",type:"imageAd",items:Array.from({length:11},(_,index)=>({id:String(index),imageUrl:"https://example.com/a.jpg",alt:""}))}]})).toThrow();expect(()=>parsePageConfig({version:4,themeColor:"#123456",components:[{id:"a",type:"imageAd",items:[{id:"1",imageUrl:"https://example.com/a.jpg",alt:"",target:{type:"custom",url:"javascript:alert(1)"}}]}]})).toThrow();expect(()=>parsePageConfig({version:4,themeColor:"#123456",components:[{id:"g",type:"productGroupTabs",title:"x",groups:Array.from({length:16},(_,index)=>({categoryId:String(index),limit:null}))}]})).toThrow()});
  it("allows only safe template image paths",()=>{expect(parsePageConfig({version:4,themeColor:"#123456",components:[{id:"a",type:"imageAd",items:[{id:"1",imageUrl:"/templates/liangchen/hero-01.jpg",alt:""}]}]}).components[0]).toMatchObject({type:"imageAd",items:[{imageUrl:"/templates/liangchen/hero-01.jpg"}]});for(const imageUrl of ["//evil.test/a.jpg","/uploads/a.jpg","/templates/../../secret.jpg","javascript:alert(1)"])expect(()=>parsePageConfig({version:4,themeColor:"#123456",components:[{id:"a",type:"imageAd",items:[{id:"1",imageUrl,alt:""}]}]})).toThrow()});
  it("validates image-ad product groups",()=>{const make=(groups:unknown[])=>parsePageConfig({version:4,themeColor:"#123456",components:[{id:"products",type:"productGrid",title:"x",source:{mode:"all"}},{id:"a",type:"imageAd",items:[{id:"1",imageUrl:"/templates/a.jpg",alt:"",target:{type:"productGroup",groups}}]}]});expect(()=>parsePageConfig({version:4,themeColor:"#123456",components:[{id:"a",type:"imageAd",items:[{id:"1",imageUrl:"/templates/a.jpg",alt:"",target:{type:"productGroup",groups:[]}}]}]})).toThrow();expect(()=>make(Array.from({length:16},(_,index)=>({categoryId:`c${index}`,limit:null})))).toThrow();expect(()=>validatePageConfigForStore(make([{categoryId:"other",limit:null}]),{productIds:new Set(),categoryIds:new Set(["own"])})).toThrow("广告商品分组不属于当前店铺");expect(()=>validatePageConfigForStore(make([{categoryId:"own",limit:null},{categoryId:"own",limit:2}]),{productIds:new Set(),categoryIds:new Set(["own"])})).toThrow("广告商品分组不能重复")});
  it("rejects cross-store ad references and degrades stale targets",()=>{const config=parsePageConfig({version:4,themeColor:"#123456",components:[{id:"a",type:"imageAd",items:[{id:"1",imageUrl:"https://example.com/a.jpg",alt:"",target:{type:"product",productId:"other"}}]}]});expect(()=>validatePageConfigForStore(config,{productIds:new Set(["own"]),categoryIds:new Set(),pageIds:new Set()})).toThrow("广告商品不属于当前店铺");expect(resolveImageAdHref({type:"product",productId:"stale"},{storeSlug:"demo",refCode:"r",productIds:new Set(),categoryIds:new Set(),pages:new Map()})).toBeNull();expect(resolveImageAdHref({type:"page",pageId:"p1"},{storeSlug:"demo",refCode:"r",productIds:new Set(),categoryIds:new Set(),pages:new Map([["p1","sale"]])})).toBe("/s/demo/p/sale?ref=r")});
  it("defaults product tabs to the first configured group",()=>{const config=parsePageConfig({version:4,themeColor:"#123456",components:[{id:"g",type:"productGroupTabs",title:"精选",groups:[{categoryId:"c2",alias:"餐厅",limit:6},{categoryId:"c1",limit:null}]}]});expect(config.components[0]).toMatchObject({groups:[{categoryId:"c2",alias:"餐厅",limit:6},{categoryId:"c1",limit:null}]})});
  it("builds product-group links with page, item, and ref",()=>expect(resolveImageAdHref({type:"productGroup",groups:[{categoryId:"c1",limit:null}]},{storeSlug:"demo",pageId:"page-1",itemId:"ad-1",refCode:"staff code",productIds:new Set(),categoryIds:new Set(["c1"]),pages:new Map()})).toBe("/s/demo/group/page-1/ad-1?ref=staff%20code"));
});

describe("liangchen template and product groups",()=>{
  it("builds the complete snapshot without remote image URLs",()=>{const pageIds=new Map(LIANGCHEN_CONTENT_PAGES.map((page,index)=>[page.slug,`p${index}`]));const config=liangchenHomeConfig(["c1","c2"],pageIds);expect(config.components.map((item)=>item.type)).toEqual(["productSearch","heroCarousel","employeeCard","quickNav","announcement","imageAd","imageAd","productGrid"]);expect(JSON.stringify(config)).not.toContain("aliyuncs.com");expect(LIANGCHEN_CONTENT_PAGES.flatMap((page)=>page.images)).toHaveLength(13);const series=config.components.find((item)=>item.id==="liangchen-series");expect(series).toMatchObject({type:"imageAd",items:[{target:{type:"productGroup",groups:[{categoryId:"c1"},{categoryId:"c2"}]}},{target:{type:"productGroup",groups:[{categoryId:"c1"},{categoryId:"c2"}]}}]})});
  it("keeps existing content-page slugs",()=>expect(missingLiangchenContentPages(["brand-story","contact"]).map((page)=>page.slug)).toEqual(["product-intro","case","after-sales"]));
  it("filters stale groups, preserves order and alias, and limits products",()=>{const target={type:"productGroup" as const,groups:[{categoryId:"stale",limit:null},{categoryId:"c2",alias:"餐厅",limit:1},{categoryId:"c1",limit:null}]};const products=[{categoryId:"c2",id:1},{categoryId:"c2",id:2},{categoryId:"c1",id:3}];const result=resolveProductGroup(target,[{id:"c1",name:"客厅"},{id:"c2",name:"餐厨"}],products);expect(result.groups.map((group)=>group.name)).toEqual(["餐厅","客厅"]);expect(result.active?.categoryId).toBe("c2");expect(result.visibleProducts).toEqual([products[0]])});
  it("does not append a product code twice",()=>{expect(productNameWithCode("云朵沙发","LC-01")).toBe("云朵沙发 LC-01");expect(productNameWithCode("云朵沙发 LC-01","LC-01")).toBe("云朵沙发 LC-01")});
});

describe("public storefront state",()=>{
  it("moves carousel controls in webviews without element.scrollTo",()=>{
    const legacyTrack={clientWidth:390,scrollLeft:0};
    expect(()=>scrollCarouselTo(legacyTrack,2)).not.toThrow();
    expect(legacyTrack.scrollLeft).toBe(780);
    const calls:ScrollToOptions[]=[];
    scrollCarouselTo({clientWidth:390,scrollLeft:0,scrollTo:(options)=>calls.push(options)},1);
    expect(calls).toEqual([{left:390,behavior:"smooth"}]);
  });
  it("keeps ref on store links and uses the customer login return",()=>{expect(storeHref("demo","product/p1","staff code")).toBe("/s/demo/product/p1?ref=staff%20code");expect(customerHref("demo","e1","/s/demo/cart?ref=e1")).toBe("/login?store=demo&returnTo=%2Fs%2Fdemo%2Fcart%3Fref%3De1&ref=e1")});
  it("normalizes, adds and removes persisted cart lines",()=>{const empty=normalizeCart({version:1,lines:[{productId:"p1",variantId:null,quantity:1,remark:""},{productId:"bad",variantId:null,quantity:0,remark:""}]});expect(empty.lines).toHaveLength(1);const added=updateCart(empty,{productId:"p1",variantId:null},2);expect(added.lines[0].quantity).toBe(3);expect(updateCart(added,{productId:"p1",variantId:null},-3).lines).toEqual([])});
  it("limits preview reads to the configured store",()=>{const preview={isPreview:true,previewStoreSlug:"demo"};expect(canAccessPublicStore("demo",preview)).toBe(true);expect(canAccessPublicStore("other",preview)).toBe(false);expect(canAccessPublicStore("other",{isPreview:false,previewStoreSlug:null})).toBe(true)});
  it("requires deployment store variables",()=>{expect(defaultPublicStoreSlug({NODE_ENV:"test",DEFAULT_PUBLIC_STORE_SLUG:"demo"} as NodeJS.ProcessEnv)).toBe("demo");expect(()=>defaultPublicStoreSlug({NODE_ENV:"test"} as NodeJS.ProcessEnv)).toThrow("DEFAULT_PUBLIC_STORE_SLUG");expect(()=>validatePreviewStoreSlug({NODE_ENV:"test",VERCEL_ENV:"preview"} as NodeJS.ProcessEnv)).toThrow("PREVIEW_STORE_SLUG")});
  it("configures Supabase transaction pooler connections",()=>{const url=runtimeDatabaseUrl("postgresql://user:pass@example.com:6543/postgres");expect(url).toContain("pgbouncer=true");expect(url).toContain("connection_limit=1");expect(runtimeDatabaseUrl("postgresql://user:pass@example.com:5432/postgres")).not.toContain("pgbouncer")});
});

describe("page editor state",()=>{
  const header={id:"header",type:"storeHeader",style:"compact",subtitle:"x"} as const;
  const card={id:"card",type:"employeeCard",style:"dark"} as const;
  const divider={id:"divider",type:"divider"} as const;
  it("inserts palette components before, after, and at the end",()=>{
    expect(insertPageComponent([header,card],divider,"header","before").map(item=>item.id)).toEqual(["divider","header","card"]);
    expect(insertPageComponent([header,card],divider,"header","after").map(item=>item.id)).toEqual(["header","divider","card"]);
    expect(insertPageComponent([header,card],divider).map(item=>item.id)).toEqual(["header","card","divider"]);
    expect(insertPageComponent([header,card],divider,"outside").map(item=>item.id)).toEqual(["header","card"]);
  });
  it("reorders canvas components and appends when dropped on the canvas",()=>{
    expect(movePageComponent([header,card,divider],"header","divider").map(item=>item.id)).toEqual(["card","divider","header"]);
    expect(movePageComponent([header,card,divider],"header").map(item=>item.id)).toEqual(["card","divider","header"]);
  });
  it("selects the nearest component after deleting the selected one",()=>{
    expect(removePageComponent([header,card,divider],"card","card")).toMatchObject({selectedId:"divider"});
    expect(removePageComponent([header,card],"card","card")).toMatchObject({selectedId:"header"});
  });
});

describe("page management",()=>{
  const page={title:"店铺首页",slug:"home",category:"首页",draftJson:'{"version":2}'};
  it("copies the saved draft without publishing or making it home",()=>{
    expect(buildPageCopyData(page,new Set())).toEqual({title:"店铺首页（副本）",slug:"home-copy",category:"首页",draftJson:'{"version":2}',publishedJson:null,publishedAt:null,isHome:false});
  });
  it("increments duplicate slugs and keeps them within the slug limit",()=>{
    expect(buildPageCopyData(page,new Set(["home-copy"])).slug).toBe("home-copy-2");
    const slug=buildPageCopyData({...page,slug:"a".repeat(40)},new Set()).slug;
    expect(slug).toHaveLength(40);
    expect(slug.endsWith("-copy")).toBe(true);
  });
  it("uses the canonical public route for home and ordinary pages",()=>{
    expect(publicPagePath("demo","home",true)).toBe("/s/demo");
    expect(publicPagePath("demo","sale",false)).toBe("/s/demo/p/sale");
  });
});

describe("intent rule",()=>{
  it("matches favorite and cart",()=>{expect(isIntentCustomer([{type:"FAVORITE"}]).intent).toBe(true);expect(isIntentCustomer([{type:"CART_ADD"}]).intent).toBe(true)});
  it("requires three views of the same product",()=>{expect(isIntentCustomer([{type:"PRODUCT_VIEW",productId:"a"},{type:"PRODUCT_VIEW",productId:"a"},{type:"PRODUCT_VIEW",productId:"b"}]).intent).toBe(false);expect(isIntentCustomer(Array.from({length:3},()=>({type:"PRODUCT_VIEW",productId:"a"}))).intent).toBe(true)});
});

describe("permissions and attribution",()=>{
  it("lets employees see sourced or responsible orders",()=>expect(orderScope({id:"e1",role:Role.EMPLOYEE,storeId:"s1"})).toEqual({storeId:"s1",OR:[{sourceEmployeeId:"e1"},{responsibleEmployeeId:"e1"}]}));
  it("keeps platform support out of business data",()=>{expect(canOperateStore({id:"p",role:Role.PLATFORM_ADMIN,storeId:null},"s","catalog")).toBe(true);expect(canOperateStore({id:"p",role:Role.PLATFORM_ADMIN,storeId:null},"s","business")).toBe(false)});
  it("uses only the last valid authenticated employee source",()=>{expect(lastValidAttribution({employeeId:"e",employeeActive:true,sameStore:true,authenticatedAction:true})).toBe("e");expect(lastValidAttribution({employeeId:"e",employeeActive:false,sameStore:true,authenticatedAction:true})).toBeNull()});
});

describe("page asset uploads",()=>{
  it("limits roles, stores, formats, and size",()=>{expect(canUploadPageAsset({role:Role.STORE_ADMIN,storeId:"s1"},"s1")).toBe(true);expect(canUploadPageAsset({role:Role.STORE_ADMIN,storeId:"s1"},"s2")).toBe(false);expect(canUploadPageAsset({role:Role.PLATFORM_ADMIN,storeId:null},"s2","s2")).toBe(true);expect(PAGE_ASSET_MIME_TYPES).toEqual(["image/jpeg","image/png","image/webp"]);expect(PAGE_ASSET_MAX_SIZE).toBe(5*1024*1024)});
});

describe("V2 multi-variant import",()=>{
  const base:ImportRow={row:2,name:"沙发",code:"P1",categoryName:"客厅",mainImageUrl:"https://example.com/a.jpg",detailImageUrls:"",variantName:"三人位",variantCode:"P1-3",priceText:"100",stockText:"2",unit:"套",description:"",sortText:"1"};
  it("groups repeated product codes as variants",()=>{const result=groupImportRows([base,{...base,row:3,variantName:"四人位",variantCode:"P1-4"}],new Set(),new Set(["客厅"]));expect(result.errors).toHaveLength(0);expect(result.products[0].variants).toHaveLength(2)});
  it("skips a whole product when one variant is invalid",()=>{const result=groupImportRows([base,{...base,row:3,variantCode:"P1-3"}],new Set(),new Set(["客厅"]));expect(result.products).toEqual([]);expect(result.errors).toEqual([{row:3,reason:"同一商品的规格编码重复"}])});
});
