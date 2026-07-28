Previous session: 019fa8bc-a05c-7092-a6a8-b7cd8c408ab0
JSONL: ~/.codex/sessions/2026/07/28/rollout-2026-07-28T20-39-21-019fa8bc-a05c-7092-a6a8-b7cd8c408ab0.jsonl
To review: use /agent-log skill with the JSONL path above

## Context

Implemented the agreed "良丞风格" dynamic H5 homepage and page-decoration V4: product-group tabs, multi-image ads, store-scoped customer cards, page asset uploads, shared online/editor rendering, additive Prisma migrations, and Supabase Storage deployment SQL. Then fixed a production client-side crash when opening a page in the editor or dragging components.

## Current state

- `main` is clean and equals `origin/main` at `558b1734260ad970555f6c3b9075942d5a3082ec`.
- Commit `03c1176` contains the V4 homepage/editor/account/Storage implementation. Commit `558b173` fixes the editor crash and adds the durable editor constraint.
- Crash root cause: `PublicHome` renders `ProductCard`, which calls `usePublicCart`; the public route had `PublicCartProvider`, but the admin canvas did not. The canvas is now wrapped in the existing provider.
- Verified: component repro changed from `usePublicCart must be used inside PublicCartProvider` to `PASS`; 56 Vitest tests, ESLint, `tsc --noEmit`, production build, and `git diff --check` pass.
- Not verified live: Vercel deployment of `558b173`, authenticated editor click/drag in a real browser, 320/390/430 screenshots, live customer-card refresh, four ad target types, product-tab switching, real Supabase `page-assets` upload, or production migration execution.
- No database or Storage SQL was executed in this session.

## Key files

- `AGENTS.md` - repository search and editing rules; LSP first when exposed.
- `lib/page-config.ts` - `PageConfigV4`, V1-V3 upgrades, limits, target validation, stale-link degradation, templates.
- `app/admin/pages/[id]/page-editor.tsx` - shared canvas, DnD, group and image-ad editors, and the crash fix at the preview Provider boundary.
- `app/admin/pages/[id]/page.tsx` - editor data loading for products, category counts, dates, and published pages.
- `app/admin/phase-one-actions.ts` - store-scoped draft/publish validation including published page targets.
- `app/s/[slug]/public-home.tsx` - shared V4 homepage renderer and group/ad interactions.
- `app/s/[slug]/page.tsx` - published homepage query and current-store customer-card resolution; `ref` remains attribution only.
- `app/s/[slug]/layout.tsx` - public `PublicCartProvider` and mobile shell boundary.
- `components/public/cart-provider.tsx` - cart Context contract that caused the editor crash when missing.
- `components/public/product-card.tsx` - shared product card that consumes cart Context.
- `app/s/[slug]/storefront.tsx` - legacy/custom-page component compatibility.
- `lib/home-card.ts` - pure customer/default card priority mapping.
- `app/me/settings/page.tsx`, `app/me/settings/settings-client.tsx` - store-scoped customer card fields and settings UI.
- `app/api/customer/settings/profile/route.ts` - saves `cardTitle` and `cardBio`.
- `lib/page-assets.ts`, `app/api/page-assets/route.ts` - 5 MB JPG/PNG/WebP upload rules, roles, store/page isolation, and error mapping.
- `prisma/schema.prisma` - `CustomerProfile.cardTitle/cardBio` and existing account settings fields.
- `prisma/migrations/20260728000100_customer_settings/migration.sql` - pre-existing account settings migration; intentionally not modified for card copy.
- `prisma/migrations/20260728000200_customer_card_copy/migration.sql` - additive `cardTitle/cardBio` migration.
- `supabase/product-storage.sql` - public `page-assets` bucket plus existing buckets.
- `app/globals.css` - V4 mobile homepage and settings styles.
- `tests/phase-one.test.ts`, `tests/customer-settings.test.ts`, `tests/validation.test.ts` - V4, upload, link, card, and validation coverage.
- `docs/Supabase数据库与Storage部署说明.md` - deployment order and four-bucket checklist.
- `docs/specs/page-editor.md` - durable Provider invariant for shared editor components.
- `/Users/panda/Desktop/best-practice/ai-dev-pipeline/skills/bugfix/SKILL.md` - debugging workflow used for the crash.
- `/Users/panda/Desktop/best-practice/ai-dev-pipeline/skills/e2e-verify/SKILL.md` - suggested next-session acceptance workflow.

## Next steps

1. Confirm the Vercel deployment includes commit `558b173`; do not assume a Git push means production is updated.
2. Sign in as a store admin and verify opening an editor page, clicking components, and dragging product-related components no longer produces a console exception.
3. Before application rollout, execute `supabase/product-storage.sql`, then `npm run db:deploy`, then deploy the application. Confirm the target environment and backup before any production mutation.
4. Run authenticated browser acceptance for customer-card refresh, image upload, all four ad targets, product-group switching, and editor/online parity at 320/390/430px.
5. If acceptance fails, resume `/bugfix` from the Debug Chain below; otherwise use `/e2e-verify` and record live evidence without changing code unnecessarily.

## Suggested skills

- `/e2e-verify` for the remaining authenticated browser and deployment acceptance.
- `/bugfix` only if the editor or another acceptance path still throws.
- `browser:control-in-app-browser` when browser control is exposed and authenticated state is available.

## Debug Chain

- Session 1 [`019fa8bc-a05c-7092-a6a8-b7cd8c408ab0`]: Phases 0-6 complete.
  - Feedback loop: rendered the real `ProductCard` with `react-dom/server`; without Provider it failed deterministically with `usePublicCart must be used inside PublicCartProvider`, and with `PublicCartProvider` it returned `PASS`.
  - Ruled out: DnD event conflict, because a standalone product render failed before drag handling; invalid V4 data, because the minimal product fixture was valid; Vercel-only stale assets, because local source reproduced the exact stack.
  - Pending hypotheses: none for the identified crash. Live Vercel deployment and authenticated browser confirmation remain pending acceptance, not diagnosis.
  - Key discovery: shared public components carry runtime Context dependencies; visual renderer reuse alone is insufficient unless the admin preview reproduces those Provider boundaries.
  - Next step: deploy `558b173`, then repeat the original open/click/drag flow while watching the browser console.
