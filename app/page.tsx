import { notFound, redirect } from "next/navigation";
import { canAccessPublicStore } from "@/lib/deployment-scope";
import { defaultPublicStoreSlug } from "@/lib/server-env";

export default function Home() {
  const slug = defaultPublicStoreSlug();
  if (!canAccessPublicStore(slug)) notFound();
  redirect(`/s/${encodeURIComponent(slug)}`);
}
