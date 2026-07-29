# Local-dev image: serves demo.html via the Vite dev server with hot reload
# against source mounted in as a volume by docker-compose.yml. The production
# embeddable bundle (`pnpm build`) is built on the host, not in this container.
FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/widget/package.json apps/widget/package.json

RUN pnpm install

COPY packages/shared packages/shared
COPY apps/widget apps/widget

RUN pnpm --filter @mpe-chatbot/shared build

EXPOSE 5173

CMD ["pnpm", "--filter", "@mpe-chatbot/widget", "dev"]
