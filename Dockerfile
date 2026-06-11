# SHCKB container image (MVP-2 deploy shape; ADR-0019/0020).
# Canonical-artifact ratification is still a future ADR, but this image
# follows the product shape: one artifact serving API + built web,
# /data volume as the complete instance state (sqlite + blobs),
# migrations auto-applied at startup.
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/grid-engine/package.json packages/grid-engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile
COPY packages ./packages
COPY apps ./apps
RUN cd apps/web && bun run build

FROM oven/bun:1.3 AS runtime
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/grid-engine/package.json packages/grid-engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --production
COPY packages/grid-engine ./packages/grid-engine
COPY apps/server/src ./apps/server/src
COPY apps/server/drizzle ./apps/server/drizzle
COPY apps/server/package.json ./apps/server/
COPY --from=build /app/apps/web/dist ./apps/web/dist

ARG SHCKB_VERSION=dev
ENV SHCKB_VERSION=${SHCKB_VERSION}
ENV SHCKB_WEB_DIST=/app/apps/web/dist
ENV SHCKB_DB_PATH=/data/shckb.db
ENV SHCKB_BLOB_DIR=/data/blobs
EXPOSE 3000
WORKDIR /app/apps/server
CMD ["bun", "src/index.ts"]
