# Deployment invariants

- When `prisma/schema.prisma` changes, the production build must regenerate Prisma Client before TypeScript compilation. Otherwise, dependency caches can leave generated client types out of sync with the schema and make deployment compilation fail.
