# Stage 1: builder
FROM node:20-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter=api...
RUN pnpm --filter=@linea/db build
RUN pnpm --filter=api build

# Stage 2: runner
FROM node:20-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 linea \
  && adduser  --system --uid 1001 --ingroup linea linea

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/db/package.json    ./packages/db/package.json
COPY apps/api/package.json       ./apps/api/package.json

RUN pnpm install --frozen-lockfile --filter=api... --prod

COPY --from=builder /app/packages/db/dist  ./packages/db/dist
COPY --from=builder /app/apps/api/dist     ./apps/api/dist

USER linea

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "apps/api/dist/main.js"]
