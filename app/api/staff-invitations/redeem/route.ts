import { redeemStaffInvitation } from "@/lib/staff-invitations";

export async function POST(request: Request) {
  try {
    const user = await redeemStaffInvitation(await request.json().catch(() => null));
    return Response.json({ user: { id: user.id, username: user.username, role: user.role } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册失败，请稍后重试";
    return Response.json({ error: message }, { status: message === "登录账号已存在" ? 409 : 400 });
  }
}
