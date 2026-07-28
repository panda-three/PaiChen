import { previewStaffInvitation, staffRoleLabel } from "@/lib/staff-invitations";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("invite") ?? "";
  const invitation = await previewStaffInvitation(token);
  if (!invitation) return Response.json({ error: "邀请不存在" }, { status: 404 });
  return Response.json({ storeName: invitation.storeName, role: staffRoleLabel(invitation.role), phone: invitation.phone, unavailable: invitation.unavailable });
}
