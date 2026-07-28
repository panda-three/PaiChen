import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHome } from "../app/s/[slug]/public-home";
import { GroupCatalog } from "../app/s/[slug]/group/[pageId]/[itemId]/group-catalog";
import { parsePageConfig } from "../lib/page-config";

const catalog = { store: { slug: "liangchen", name: "良丞家具", logoUrl: null }, categories: [], products: [], customerActive: false };

describe("liangchen public components", () => {
  it("renders the yuncheng employee card and hides unavailable contacts", () => {
    const config = parsePageConfig({ version: 4, themeColor: "#30302e", components: [{ id: "card", type: "employeeCard", style: "yuncheng" }] });
    const html = renderToStaticMarkup(<PublicHome catalog={catalog} config={config} employee={{ name: "方小姐", phone: "13800000000", wechat: null, title: "木作主理人", bio: "一站式整装", avatarUrl: "/templates/liangchen/avatar.png" }} favoriteIds={[]}/>);
    expect(html).toContain("public-adviser-yuncheng");
    expect(html).toContain("tel:13800000000");
    expect(html).not.toContain('aria-label="微信"');
  });

  it("renders three-column product labels and detail links with ref", () => {
    const html = renderToStaticMarkup(<GroupCatalog slug="liangchen" refCode="staff-1" groups={[{ categoryId: "c1", name: "客厅", limit: null }]} products={[{ id: "p1", name: "云朵沙发", code: "LC-01", mainImageUrl: "/templates/liangchen/new-01.jpg", categoryId: "c1" }]}/>);
    expect(html).toContain("public-group-grid");
    expect(html).toContain("云朵沙发 LC-01");
    expect(html).toContain("/s/liangchen/product/p1?ref=staff-1");
  });
});
