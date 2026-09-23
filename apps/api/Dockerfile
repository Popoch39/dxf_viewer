# Production image of the API. Build from the repo root (the monorepo lockfile lives there):
#   docker build -f apps/api/Dockerfile -t dxf-viewer-api .
# Run the server:      docker run --env-file apps/api/.env -p 3000:3000 dxf-viewer-api
# Apply migrations:    docker run --env-file apps/api/.env dxf-viewer-api ./migrate
FROM oven/bun:1.4.2 AS build

WORKDIR /repo

# Cache the install: only the manifests of the workspaces the lockfile knows about.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/viewer/package.json apps/viewer/
COPY packages/dxf/package.json packages/dxf/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile --production --ignore-scripts --filter api

COPY apps/api apps/api

WORKDIR /repo/apps/api

ENV NODE_ENV=production

RUN bun build --compile --minify-whitespace --minify-syntax --target bun --outfile server src/index.ts \
 && bun build --compile --minify-whitespace --minify-syntax --target bun --outfile migrate src/db/migrate.ts

FROM gcr.io/distroless/base-debian12

WORKDIR /app

COPY --from=build /repo/apps/api/server /repo/apps/api/migrate ./
COPY --from=build /repo/apps/api/drizzle ./drizzle

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./server"]
