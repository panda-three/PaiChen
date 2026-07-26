import { redirect } from "next/navigation";

export default async function CustomerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  redirect(`/login${params.size ? `?${params}` : ""}`);
}
