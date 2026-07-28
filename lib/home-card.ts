import { Role } from "@prisma/client";

export type HomeCard = { name: string; phone: string | null; wechat: string | null; title: string | null; bio: string | null; avatarUrl: string | null };

export function resolveHomeCard(defaultCard: HomeCard, user: (HomeCard & { role: Role }) | null): HomeCard {
  if (!user || (user.role !== Role.STORE_ADMIN && user.role !== Role.EMPLOYEE)) return defaultCard;
  return { name: user.name, phone: user.phone, wechat: user.wechat, title: user.title, bio: user.bio, avatarUrl: user.avatarUrl };
}
