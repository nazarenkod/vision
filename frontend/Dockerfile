# syntax=docker/dockerfile:1
# Pinned by digest: a rebuild gets the same base, and a scanner sees one exact image.
ARG NODE_IMAGE=node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
# nginx that runs as its own unprivileged user and listens on 8080
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03

### Build: static files, so built once on the native platform for every target platform
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS builder
WORKDIR /app
# A mirror of the npm registry (e.g. the bank's); empty: the public one
ARG NPM_REGISTRY=

# Dependencies first: a change in the code then keeps the cached npm ci
COPY package*.json .
# overrides point a dev dependency at a patched copy here (vendor/deepmerge/README.md)
COPY vendor ./vendor
# TLS is verified; a re-signing proxy is trusted through the build secret "extra_ca"
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi; \
    npm ci

COPY /public ./public
COPY /src ./src
COPY index.html tsconfig.json vite.config.ts ./
RUN npm run build

### Run
FROM ${NGINX_IMAGE}
COPY /nginx /etc/nginx/conf.d
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/build .
# env.sh writes env-config.js here at start, as the nginx user
COPY --chmod=755 ./env.sh .
# the settings env.sh writes into env-config.js, with their defaults (no secrets)
COPY env.defaults .
USER root
RUN chown -R nginx:nginx /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["/bin/sh", "-c", "/usr/share/nginx/html/env.sh && nginx -g \"daemon off;\""]
