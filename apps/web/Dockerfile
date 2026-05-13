FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter=web...

EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["pnpm", "--filter", "web", "exec", "next", "dev", "--turbopack", "--hostname", "0.0.0.0", "--port", "3000"]
