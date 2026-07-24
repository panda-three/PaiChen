import { Role } from "@prisma/client";
import { requireActor } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { ImportClient } from "./import-client";

export default async function ProductImportPage() {
  await requireActor([Role.STORE_ADMIN]);
  return <><PageHeader title="Excel 导入商品" description="逐行反馈结果，成功商品默认保持下架" /><ImportClient /></>;
}
