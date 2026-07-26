export type CopyableStorePage = {
  title: string;
  slug: string;
  category: string;
  draftJson: string;
};

function copySlug(sourceSlug: string, suffix: string) {
  const maxBaseLength = 40 - suffix.length;
  const base = sourceSlug.slice(0, maxBaseLength).replace(/-+$/, "") || "page";
  return `${base}${suffix}`;
}

export function buildPageCopyData(page: CopyableStorePage, existingSlugs: Set<string>) {
  let index = 1;
  let slug = copySlug(page.slug, "-copy");
  while (existingSlugs.has(slug)) {
    index += 1;
    slug = copySlug(page.slug, `-copy-${index}`);
  }

  return {
    title: `${page.title}（副本）`,
    slug,
    category: page.category,
    draftJson: page.draftJson,
    publishedJson: null,
    publishedAt: null,
    isHome: false,
  };
}

export function publicPagePath(storeSlug: string, pageSlug: string, isHome: boolean) {
  return isHome ? `/s/${storeSlug}` : `/s/${storeSlug}/p/${pageSlug}`;
}
