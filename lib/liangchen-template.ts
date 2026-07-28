import type { PageConfigV4 } from "@/lib/page-config";

const root = "/templates/liangchen";

export const LIANGCHEN_CONTENT_PAGES = [
  { title: "企业介绍", slug: "brand-story", images: [`${root}/content/brand-01.jpg`] },
  { title: "丞礼系列", slug: "product-intro", images: Array.from({ length: 5 }, (_, index) => `${root}/content/chengli-${String(index + 1).padStart(2, "0")}.jpg`) },
  { title: "丞宋系列", slug: "case", images: Array.from({ length: 5 }, (_, index) => `${root}/content/chengsong-${String(index + 1).padStart(2, "0")}.jpg`) },
  { title: "售后保障", slug: "after-sales", images: [`${root}/content/after-sales-01.jpg`] },
  { title: "专属接待", slug: "contact", images: [`${root}/content/contact-01.jpg`] },
] as const;

export function missingLiangchenContentPages(existingSlugs: Iterable<string>) {
  const existing = new Set(existingSlugs);
  return LIANGCHEN_CONTENT_PAGES.filter((definition) => !existing.has(definition.slug));
}

export function liangchenContentPageConfig(definition: (typeof LIANGCHEN_CONTENT_PAGES)[number]): PageConfigV4 {
  return {
    version: 4,
    themeColor: "#30302e",
    components: [{
      id: `liangchen-content-${definition.slug}`,
      type: "imageAd",
      title: "",
      subtitle: "",
      layout: "stack",
      items: definition.images.map((imageUrl, index) => ({ id: `${definition.slug}-${index + 1}`, imageUrl, alt: definition.title, title: "", subtitle: "" })),
    }],
  };
}

export function liangchenHomeConfig(categoryIds: string[], pageIdsBySlug: Map<string, string>): PageConfigV4 {
  const groups = categoryIds.map((categoryId) => ({ categoryId, limit: null }));
  const nav = [
    ["品牌介绍", "brand-story", "building"],
    ["丞礼系列", "product-intro", "sofa"],
    ["丞宋系列", "case", "images"],
    ["售后保障", "after-sales", "shield"],
    ["专属接待", "contact", "phone"],
  ] as const;
  return {
    version: 4,
    themeColor: "#30302e",
    components: [
      { id: "liangchen-hero", type: "heroCarousel", slides: Array.from({ length: 4 }, (_, index) => ({ title: "", subtitle: "", imageUrl: `${root}/hero-${String(index + 1).padStart(2, "0")}.jpg`, href: "" })) },
      { id: "liangchen-card", type: "employeeCard", style: "yuncheng" },
      { id: "liangchen-nav", type: "quickNav", items: nav.map(([title, slug, icon]) => ({ title, href: "", icon, pageId: pageIdsBySlug.get(slug) })) },
      { id: "liangchen-news", type: "announcement", messages: ["实木整装 618 预热开启，全屋木作 + 成品家具定制享整装专属特惠；名额有限，抓紧时间点击拨打首页电话咨询！！！"] },
      { id: "liangchen-series", type: "imageAd", title: "两大系列", subtitle: "诚邀品鉴", layout: "stack", items: [
        { id: "liangchen-chengli", imageUrl: `${root}/series-chengli.jpg`, alt: "新中式系列-丞礼", title: "新中式系列-丞礼", subtitle: "承东方之礼，造现代之家", target: { type: "productGroup", title: "新中式系列-丞礼", groups } },
        { id: "liangchen-chengsong", imageUrl: `${root}/series-chengsong.jpg`, alt: "宋氏美学系列-丞宋", title: "宋氏美学系列-丞宋", subtitle: "品宋韵风华，享世家雅境", target: { type: "productGroup", title: "宋氏美学系列-丞宋", groups } },
      ] },
      { id: "liangchen-new", type: "imageAd", title: "新品推荐", subtitle: "空间展示 · 诚邀品鉴", layout: "carousel", items: Array.from({ length: 4 }, (_, index) => ({ id: `liangchen-new-${index + 1}`, imageUrl: `${root}/new-${String(index + 1).padStart(2, "0")}.jpg`, alt: `新品推荐 ${index + 1}`, title: "", subtitle: "" })) },
      { id: "liangchen-products", type: "productGrid", title: "爆款特惠", subtitle: "全屋配齐尽享折上折", layout: "yuncheng", limit: 9, source: { mode: "all" } },
    ],
  };
}
