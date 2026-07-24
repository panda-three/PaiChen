import { describe,expect,it } from "vitest";
import { Role } from "@prisma/client";
import { lastValidAttribution } from "../lib/attribution";
import { groupImportRows,ImportRow } from "../lib/product-import";
import { isIntentCustomer,parsePageConfig,sanitizeRichText } from "../lib/validation";
import { validatePageConfigForStore } from "../lib/page-config";
import { canOperateStore,orderScope } from "../lib/scopes";

describe("page config",()=>{
  it("upgrades V1 and strips executable rich text",()=>{const config=parsePageConfig({version:1,components:[{id:"a",type:"richText",html:'<p onclick="bad()">安全</p><script>alert(1)</script>'},{id:"p",type:"products",title:"商品",productIds:["p1"]}]});expect(config.version).toBe(2);expect(config.components.map(x=>x.type)).toEqual(["storeHeader","employeeCard","richText","productGrid"]);expect(config.components.find(x=>x.type==="richText")).toMatchObject({html:"<p>安全</p>"});expect(config.components.find(x=>x.type==="productGrid")).toMatchObject({source:{mode:"selected",productIds:["p1"]}})});
  it("rejects unknown component types",()=>expect(()=>parsePageConfig({version:1,components:[{id:"x",type:"payment"}]})).toThrow());
  it("blocks javascript URLs",()=>expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:"));
  it("rejects cross-store product and category references",()=>{const available={productIds:new Set(["own-product"]),categoryIds:new Set(["own-category"])};expect(()=>validatePageConfigForStore(parsePageConfig({version:2,components:[{id:"x",type:"productGrid",title:"x",source:{mode:"selected",productIds:["other-product"]}}]}),available)).toThrow("商品不属于当前店铺");expect(()=>validatePageConfigForStore(parsePageConfig({version:2,components:[{id:"x",type:"productGrid",title:"x",source:{mode:"category",categoryId:"other-category"}}]}),available)).toThrow("商品分类不属于当前店铺")});
  it("requires bound header, card and product grid on homepages",()=>{const config=parsePageConfig({version:2,components:[{id:"h",type:"storeHeader",style:"compact",subtitle:"x"},{id:"c",type:"employeeCard",style:"dark"}]});expect(()=>validatePageConfigForStore(config,{productIds:new Set(),categoryIds:new Set()},true)).toThrow("主页必须包含")});
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

describe("V2 multi-variant import",()=>{
  const base:ImportRow={row:2,name:"沙发",code:"P1",categoryName:"客厅",mainImageUrl:"https://example.com/a.jpg",detailImageUrls:"",variantName:"三人位",variantCode:"P1-3",priceText:"100",stockText:"2",unit:"套",description:"",sortText:"1"};
  it("groups repeated product codes as variants",()=>{const result=groupImportRows([base,{...base,row:3,variantName:"四人位",variantCode:"P1-4"}],new Set(),new Set(["客厅"]));expect(result.errors).toHaveLength(0);expect(result.products[0].variants).toHaveLength(2)});
  it("keeps row-level errors",()=>{const result=groupImportRows([base,{...base,row:3,variantCode:"P1-3"}],new Set(),new Set(["客厅"]));expect(result.errors).toEqual([{row:3,reason:"同一商品的规格编码重复"}])});
});
