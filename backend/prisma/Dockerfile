# syntax=docker/dockerfile:1
# Pinned by digest: a rebuild gets the same base, and a scanner sees one exact image.
ARG NODE_IMAGE=node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
FROM ${NODE_IMAGE}
# the migration engine looks for OpenSSL to pick its build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN chown node:node /app
# A mirror of the npm registry and of Prisma's engines (e.g. the bank's); empty: the public ones
ARG NPM_REGISTRY=
ARG PRISMA_ENGINES_MIRROR=
ENV CHECKPOINT_DISABLE=1 PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}

COPY --chown=node:node . .
USER node
# TLS is verified; a re-signing proxy is trusted through the build secret "extra_ca"
RUN --mount=type=secret,id=extra_ca,required=false,uid=1000 \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    npm ci && npx prisma generate && rm -rf node_modules/elkjs
# migrations need the CLI but never the graph layout of its Studio, the one EPL-2.0 package (elkjs)

ENTRYPOINT ["/app/entrypoint.sh"]
