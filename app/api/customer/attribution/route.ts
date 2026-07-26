import { Role } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/customer-auth";
import { db } from "@/lib/db";
import { canAccessPublicStore } from "@/lib/deployment-scope";

const schema=z.object({storeSlug:z.string(),ref:z.string(),sessionId:z.string().uuid().optional()});
export async function POST(request:Request){const session=await auth();if(session?.user?.role!==Role.CUSTOMER)return Response.json({error:"Unauthorized"},{status:401});const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"内容不正确"},{status:400});if(!canAccessPublicStore(parsed.data.storeSlug))return Response.json({error:"Preview 仅允许测试店铺写入"},{status:403});const employee=await db.user.findFirst({where:{store:{slug:parsed.data.storeSlug,isActive:true},shareCode:parsed.data.ref,role:Role.EMPLOYEE,isActive:true}});if(!employee?.storeId)return Response.json({ok:true});await db.$transaction([db.customerAttribution.updateMany({where:{storeId:employee.storeId,customerId:session.user.id,isCurrent:true},data:{isCurrent:false}}),db.customerAttribution.create({data:{storeId:employee.storeId,customerId:session.user.id,employeeId:employee.id,reason:"LOGIN",isCurrent:true}}),...(parsed.data.sessionId?[db.behaviorEvent.updateMany({where:{sessionId:parsed.data.sessionId,storeId:employee.storeId,customerId:null},data:{customerId:session.user.id}})]:[])]);return Response.json({ok:true});}
