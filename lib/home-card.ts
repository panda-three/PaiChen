export type HomeCard = { name: string; phone: string | null; wechat: string | null; title: string | null; bio: string | null; avatarUrl: string | null; serviceQrUrl?: string | null };

export function resolveHomeCard(defaultCard: HomeCard, profile: { name: string; phone: string; avatarUrl: string | null; servicePhone: string | null; serviceWechat: string | null; serviceQrUrl: string | null; cardTitle: string | null; cardBio: string | null } | null): HomeCard {
  if (!profile) return defaultCard;
  return { name: profile.name, phone: profile.servicePhone || profile.phone, wechat: profile.serviceWechat, title: profile.cardTitle, bio: profile.cardBio, avatarUrl: profile.avatarUrl, serviceQrUrl: profile.serviceQrUrl };
}
