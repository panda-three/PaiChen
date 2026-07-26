# Deployment invariants

- When `prisma/schema.prisma` changes, the production build must regenerate Prisma Client before TypeScript compilation. Otherwise, dependency caches can leave generated client types out of sync with the schema and make deployment compilation fail.
- Product image imports require the private `product-imports` bucket and public `product-images` bucket from `supabase/product-storage.sql`. Only the server may receive `SUPABASE_SERVICE_ROLE_KEY`; never expose it through a `NEXT_PUBLIC_` variable.
- Temporary Excel objects are deleted after every import attempt. Configure a storage lifecycle rule for `product-imports` as a secondary safeguard for abandoned browser uploads.
- `DEFAULT_PUBLIC_STORE_SLUG` must name the production store served by `/`. On Vercel Preview, `PREVIEW_STORE_SLUG` is mandatory and all other public store reads return 404 while writes return 403.
- Preview uses a separate `AUTH_SECRET` and Vercel Deployment Protection. Never reuse production customer sessions for Preview acceptance.
- The supported runtime is Node.js `22.x`; keep `prisma generate && next build` as the build command.
- Development output lives in `.next-dev` while production output lives in `.next`. Do not point both compilers at one directory; mixed webpack runtimes and chunks cause intermittent `MODULE_NOT_FOUND` failures.
