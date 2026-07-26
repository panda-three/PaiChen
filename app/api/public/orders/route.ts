import { AuthorizationStatus, CustomerStatus, ProductSource, Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { publicOrderSchema } from "@/lib/validation";
import { canAccessPublicStore } from "@/lib/deployment-scope";

export async function POST(request: Request) {
  const session=await auth();if(session?.user?.role!==Role.CUSTOMER)return Response.json({error:"请先登录已审核激活的客户账号"},{status:401});
  const raw=await request.json().catch(()=>null);const parsed=publicOrderSchema.safeParse(raw);if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message??"提交内容不正确"},{status:400});const input=parsed.data;
  if(!canAccessPublicStore(input.storeSlug))return Response.json({error:"Preview 仅允许测试店铺写入"},{status:403});
  const customer=await db.user.findFirst({where:{id:session.user.id,role:Role.CUSTOMER,isActive:true,customerStatus:CustomerStatus.ACTIVE}});if(!customer?.phone)return Response.json({error:"客户账号不可用"},{status:401});
  const store=await db.store.findUnique({where:{slug:input.storeSlug},include:{users:{where:{shareCode:input.ref??undefined,role:Role.EMPLOYEE,isActive:true},take:1}}});if(!store?.isActive||!store.customerEnabled)return Response.json({error:"店铺暂不可用"},{status:404});const sourceEmployee=store.users[0]??null;
  if(!await db.customerProfile.findFirst({where:{storeId:store.id,customerId:customer.id,status:CustomerStatus.ACTIVE}}))return Response.json({error:"客户尚未通过当前店铺审核"},{status:403});
  const existing=await db.order.findUnique({where:{idempotencyKey:input.clientRequestId}});if(existing){if(existing.storeId!==store.id||existing.customerId!==customer.id)return Response.json({error:"重复请求标识冲突"},{status:409});return Response.json({orderNo:existing.orderNo,storePhone:store.phone});}
  const products=await db.product.findMany({where:{id:{in:input.items.map(x=>x.productId)},storeId:store.id,isPublished:true,isDeleted:false,category:{isActive:true},OR:[{source:{not:ProductSource.ENTERPRISE}},{authorization:{status:AuthorizationStatus.ACTIVE}}]},include:{variants:true}});const productMap=new Map(products.map(x=>[x.id,x]));if(products.length!==new Set(input.items.map(x=>x.productId)).size)return Response.json({error:"部分商品已下架，请刷新后重试"},{status:400});
  for(const item of input.items){const product=productMap.get(item.productId)!;if(item.variantId&&!product.variants.some(x=>x.id===item.variantId))return Response.json({error:"商品规格已失效"},{status:400});}
  const now=new Date();const orderNo=`YC${now.toISOString().slice(0,10).replaceAll("-","")}${String(Date.now()).slice(-6)}`;
  const order=await db.$transaction(async tx=>{
    const profile=await tx.customerProfile.upsert({where:{storeId_customerId:{storeId:store.id,customerId:customer.id}},create:{storeId:store.id,customerId:customer.id,name:customer.name,phone:customer.phone!,status:CustomerStatus.ACTIVE,sourceEmployeeId:sourceEmployee?.id,approvedAt:now},update:{name:customer.name,status:CustomerStatus.ACTIVE}});
    const lead=await tx.lead.upsert({where:{storeId_phone:{storeId:store.id,phone:customer.phone!}},create:{storeId:store.id,name:customer.name,phone:customer.phone!,latestEmployeeId:sourceEmployee?.id,firstOrderAt:now,lastOrderAt:now},update:{name:customer.name,...(sourceEmployee?{latestEmployeeId:sourceEmployee.id}:{}),lastOrderAt:now}});
    if(sourceEmployee){await tx.customerAttribution.updateMany({where:{storeId:store.id,customerId:customer.id,isCurrent:true},data:{isCurrent:false}});await tx.customerAttribution.create({data:{storeId:store.id,customerId:customer.id,employeeId:sourceEmployee.id,reason:"ORDER_SUBMIT",isCurrent:true}});}
    const created=await tx.order.create({data:{orderNo,idempotencyKey:input.clientRequestId,storeId:store.id,leadId:lead.id,customerId:customer.id,sourceEmployeeId:sourceEmployee?.id,responsibleEmployeeId:sourceEmployee?.id,customerName:customer.name,customerPhone:customer.phone!,customerAddress:input.customerAddress,customerRemark:input.customerRemark,items:{create:input.items.map(item=>{const product=productMap.get(item.productId)!;const variant=product.variants.find(x=>x.id===item.variantId)??product.variants[0];const snapshotPrice=variant?.price??product.price;return{productId:product.id,variantId:variant?.id,productName:product.name,productCode:product.code,imageUrl:variant?.imageUrl||product.mainImageUrl,specification:variant?[variant.name,variant.specification].filter(Boolean).join(" · "):product.specification,variantCode:variant?.code,price:snapshotPrice,salePrice:snapshotPrice,unit:product.unit,quantity:item.quantity,remark:item.remark}})}}});
    await tx.behaviorEvent.create({data:{storeId:store.id,sessionId:input.clientRequestId,dedupeKey:`order:${input.clientRequestId}`,type:"ORDER_SUBMIT",customerId:customer.id}});void profile;return created;
  });
  return Response.json({orderNo:order.orderNo,storePhone:store.phone});
}
