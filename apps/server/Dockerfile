# Local-dev-oriented image (this project targets `docker compose up` for local use,
# not a production deployment) — builds the workspace once, then runs tsx watch
# against source mounted in as a volume by docker-compose.yml for hot reload.
FROM node:22-slim

# Prisma's query/schema engine binaries need libssl at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server/package.json apps/server/package.json

RUN pnpm install

COPY packages/shared packages/shared
COPY apps/server apps/server

RUN pnpm --filter @mpe-chatbot/shared build
RUN pnpm --filter @mpe-chatbot/server exec prisma generate

EXPOSE 4000

# Applies pending Prisma migrations then starts the dev server. Safe to run on
# every container start — `migrate deploy` is a no-op when already up to date.
CMD ["sh", "-c", "pnpm --filter @mpe-chatbot/server exec prisma migrate deploy && pnpm --filter @mpe-chatbot/server dev"]
