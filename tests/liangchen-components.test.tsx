import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHome } from "../app/s/[slug]/public-home";
import { GroupCatalog } from "../app/s/[slug]/group/[pageId]/[itemId]/group-catalog";
import { parsePageConfig } from "../lib/page-config";

const catalog = { store: { slug: "liangchen", name: "良丞家具", logoUrl: null }, categories: [], products: [], customerActive: false };

describe("liangchen public components", () => {
  it("renders floating search separately and keeps the hero image-only", () => {
    const config = parsePageConfig({ version: 4, themeColor: "#30302e", components: [
      { id: "search", type: "productSearch", placeholder: "搜索良丞商品", style: "heroOverlay" },
      { id: "hero", type: "heroCarousel", slides: [{ imageUrl: "/templates/liangchen/hero-01.jpg", title: "旧标题", subtitle: "旧副标题", href: "/legacy" }] },
    ] });
    const html = renderToStaticMarkup(<PublicHome catalog={catalog} config={config} employee={{ name: "默认名片", phone: null, wechat: null, title: null, bio: null, avatarUrl: null }} favoriteIds={[]}/>);
    expect(html).toContain('class="public-search public-search-heroOverlay"');
    expect(html.indexOf("public-search-heroOverlay")).toBeLessThan(html.indexOf("public-hero"));
    expect(html).not.toContain("/legacy");
    expect(html).not.toContain("旧标题");
    expect(html).not.toContain("旧副标题");
    expect(html).not.toContain("public-hero-search");
    expect(html).toContain('<div class="public-hero-track"><div><img');
  });

  it("renders phone and opens a complete WeChat card", () => {
    const config = parsePageConfig({ version: 4, themeColor: "#30302e", components: [{ id: "card", type: "employeeCard", style: "yuncheng" }] });
    const html = renderToStaticMarkup(<PublicHome catalog={catalog} config={config} employee={{ name: "方小姐", phone: "13800000000", wechat: "fang-wechat", wechatQrUrl: "/templates/liangchen/wechat.png", title: "木作主理人", bio: "一站式整装", avatarUrl: "/templates/liangchen/avatar.png" }} favoriteIds={[]}/>);
    expect(html).toContain("public-adviser-yuncheng");
    expect(html).toContain("tel:13800000000");
    expect(html).toContain('aria-label="致电 13800000000"');
    expect(html).toContain('aria-label="查看方小姐的微信名片"');
    expect(html).toContain('<small class="public-contact-tip" role="tooltip">13800000000</small>');
    expect(html).not.toContain('aria-label="复制微信号');
  });

  it("renders three-column product labels and detail links with ref", () => {
    const html = renderToStaticMarkup(<GroupCatalog slug="liangchen" refCode="staff-1" groups={[{ categoryId: "c1", name: "客厅", limit: null }]} products={[{ id: "p1", name: "云朵沙发", code: "LC-01", mainImageUrl: "/templates/liangchen/new-01.jpg", categoryId: "c1" }]}/>);
    expect(html).toContain("public-group-grid");
    expect(html).toContain("云朵沙发 LC-01");
    expect(html).toContain("/s/liangchen/product/p1?ref=staff-1");
  });
});
