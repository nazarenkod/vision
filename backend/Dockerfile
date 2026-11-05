# syntax=docker/dockerfile:1
# Pinned by digest: a rebuild gets the same base, and a scanner sees one exact image.
ARG NODE_IMAGE=node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
# A mirror of the npm registry (e.g. the bank's); empty: the public one
ARG NPM_REGISTRY=
# no telemetry from Prisma's CLI or from swagger-ui's install
ENV CHECKPOINT_DISABLE=1 SCARF_ANALYTICS=false

COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts package*.json ./
# overrides point a dev dependency at a patched copy here (vendor/deepmerge/README.md)
COPY vendor ./vendor

# TLS is verified. A proxy that re-signs traffic is trusted through its CA, passed as the build
# secret "extra_ca" (docker-compose.demo.yml takes it from VISION_EXTRA_CA_FILE).
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    npm ci

COPY tsconfig*.json ./
COPY src ./src
# the image keeps only what runs: no test or lint tooling
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE}
ENV NODE_ENV=production CHECKPOINT_DISABLE=1
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package*.json /app/
COPY --from=builder /app/dist /app/dist
# Not root. Compose runs it as the host user (VISION_UID), so the images and backup files it
# writes into mounted folders belong to whoever runs Vision.
USER node
EXPOSE 3000
# the working directory stays /: images go to /imageUploads, where compose mounts them
CMD ["node", "/app/dist/main.js"]
