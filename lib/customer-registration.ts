import { CustomerStatus } from "@prisma/client";

export function customerRegistrationBlock(status: CustomerStatus | null) {
  if (status === CustomerStatus.REJECTED) return "该客户账号已被拒绝";
  if (status === CustomerStatus.RESET_PENDING) return "该客户账号正在处理密码重置";
  return null;
}
