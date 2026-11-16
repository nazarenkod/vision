# Сторонні компоненти й ліцензії

Перелік того, що входить у поставку Vision: бібліотеки в образах `api`, `migration` і `ui`, базові
образи Docker, залежності Java SDK. Для юристів і ІБ банку; як рахували — наприкінці.

## Підсумок

| Ліцензія | Пакетів | Тип |
|---|---:|---|
| MIT (з них 2 — `MIT*`: ліцензія визначена за файлом `LICENSE` пакета) | 437 | пермісивна |
| Apache-2.0 | 48 | пермісивна |
| BSD-3-Clause, BSD-2-Clause, 0BSD | 28 | пермісивна |
| ISC | 20 | пермісивна |
| BlueOak-1.0.0 | 8 | пермісивна |
| OFL-1.1 | 4 | шрифти (Roboto) |
| PSF-2.0 | 1 | пермісивна (`argparse`) |
| `(MIT OR CC0-1.0)`, `(MIT AND Zlib)` | 2 | пермісивна |
| `(MIT OR GPL-3.0-or-later)` | 1 | `jszip`: використовується за MIT |

**Copyleft-ліцензій (GPL, AGPL, LGPL, EPL, MPL) у поставці немає.** EPL-2.0 `elkjs` (частина
Prisma Studio) видаляється під час збирання образів (`backend/Dockerfile`, `backend/prisma/Dockerfile`);
MPL-2.0 і CC-BY-4.0 є лише серед dev-залежностей, які в образи не потрапляють.

Сам Vision — Apache-2.0 ([LICENSE](../../LICENSE)), похідна робота від Visual Regression Tracker;
атрибуція — у [NOTICE](../../NOTICE). Apache-2.0 вимагає зберігати `LICENSE` і `NOTICE` у
кожній копії коду й образів.

## Базові образи Docker

Закріплені за digest у Dockerfile і `docker-compose.demo.yml`: повторне збирання бере той самий образ.

| Образ | Де | Ліцензія |
|---|---|---|
| `node:24.22.2-bookworm-slim` | `api`, `migration` | Node.js — MIT; Debian — різні вільні ліцензії |
| `node:24.22.2-alpine` | лише стадія збирання `ui` | MIT; Alpine — різні вільні ліцензії |
| `nginxinc/nginx-unprivileged:1.30.6-alpine` | `ui` | BSD-2-Clause |
| `postgres:16-alpine` | `postgres` | PostgreSQL License |
| `rclone/rclone:1.68.2` | лише бекапи, якщо rclone не встановлено на сервері | MIT |

## Java SDK (`sdk-java`)

У jar входять лише ці залежності (`sdk-java/build.gradle`, `implementation`); Selenium дає сам
проєкт тестів (`compileOnly`).

| Бібліотека | Версія | Ліцензія |
|---|---|---|
| `com.google.code.gson:gson` | 2.9.0 | Apache-2.0 |
| `org.slf4j:slf4j-api` | 1.7.25 | MIT |

## Повний перелік npm-пакетів

### API (`backend`): 343 пакетів

| Пакет | Версія | Ліцензія |
|---|---|---|
| `@aws-sdk/checksums` | 3.1001.5 | Apache-2.0 |
| `@aws-sdk/client-s3` | 3.1154.0 | Apache-2.0 |
| `@aws-sdk/core` | 3.978.5 | Apache-2.0 |
| `@aws-sdk/credential-provider-env` | 3.972.76 | Apache-2.0 |
| `@aws-sdk/credential-provider-http` | 3.972.78 | Apache-2.0 |
| `@aws-sdk/credential-provider-ini` | 3.973.21 | Apache-2.0 |
| `@aws-sdk/credential-provider-login` | 3.972.83 | Apache-2.0 |
| `@aws-sdk/credential-provider-node` | 3.972.88 | Apache-2.0 |
| `@aws-sdk/credential-provider-process` | 3.972.76 | Apache-2.0 |
| `@aws-sdk/credential-provider-sso` | 3.973.20 | Apache-2.0 |
| `@aws-sdk/credential-provider-web-identity` | 3.972.82 | Apache-2.0 |
| `@aws-sdk/middleware-sdk-s3` | 3.972.81 | Apache-2.0 |
| `@aws-sdk/nested-clients` | 3.997.50 | Apache-2.0 |
| `@aws-sdk/s3-request-presigner` | 3.1154.0 | Apache-2.0 |
| `@aws-sdk/signature-v4-multi-region` | 3.996.49 | Apache-2.0 |
| `@aws-sdk/token-providers` | 3.1155.0 | Apache-2.0 |
| `@aws-sdk/types` | 3.975.0 | Apache-2.0 |
| `@aws-sdk/xml-builder` | 3.972.41 | Apache-2.0 |
| `@aws/lambda-invoke-store` | 0.3.0 | Apache-2.0 |
| `@borewit/text-codec` | 0.2.3 | MIT |
| `@cacheable/utils` | 2.5.0 | MIT |
| `@google/genai` | 1.52.0 | Apache-2.0 |
| `@isaacs/nonrecursive-glob-match` | 1.1.0 | BlueOak-1.0.0 |
| `@jsquash/png` | 3.1.1 | Apache-2.0 |
| `@keyv/serialize` | 1.1.1 | MIT |
| `@lukeed/csprng` | 1.1.0 | MIT |
| `@microsoft/tsdoc` | 0.17.1 | MIT |
| `@nestjs/cache-manager` | 12.0.2 | MIT |
| `@nestjs/common` | 12.3.3 | MIT |
| `@nestjs/config` | 12.1.0 | MIT |
| `@nestjs/core` | 12.3.3 | MIT |
| `@nestjs/jwt` | 12.0.3 | MIT |
| `@nestjs/mapped-types` | 12.0.1 | MIT |
| `@nestjs/passport` | 12.0.0 | MIT |
| `@nestjs/platform-express` | 12.3.3 | MIT |
| `@nestjs/platform-socket.io` | 12.3.3 | MIT |
| `@nestjs/schedule` | 12.0.2 | MIT |
| `@nestjs/swagger` | 12.1.0 | MIT |
| `@nestjs/terminus` | 12.1.0 | MIT |
| `@nestjs/websockets` | 12.3.3 | MIT |
| `@nodable/entities` | 3.1.0 | MIT |
| `@odiff/darwin-arm64` | 4.5.0 | MIT |
| `@odiff/darwin-x64` | 4.5.0 | MIT |
| `@odiff/linux-arm64` | 4.5.0 | MIT |
| `@odiff/linux-riscv64` | 4.5.0 | MIT |
| `@odiff/linux-x64` | 4.5.0 | MIT |
| `@odiff/win32-arm64` | 4.5.0 | MIT |
| `@odiff/win32-x64` | 4.5.0 | MIT |
| `@prisma/adapter-pg` | 7.10.1 | Apache-2.0 |
| `@prisma/client` | 7.10.1 | Apache-2.0 |
| `@prisma/client-runtime-utils` | 7.10.1 | Apache-2.0 |
| `@prisma/debug` | 7.10.1 | Apache-2.0 |
| `@prisma/driver-adapter-utils` | 7.10.1 | Apache-2.0 |
| `@protobufjs/aspromise` | 1.1.2 | BSD-3-Clause |
| `@protobufjs/base64` | 1.1.2 | BSD-3-Clause |
| `@protobufjs/codegen` | 2.0.5 | BSD-3-Clause |
| `@protobufjs/eventemitter` | 1.1.1 | BSD-3-Clause |
| `@protobufjs/fetch` | 1.1.1 | BSD-3-Clause |
| `@protobufjs/float` | 1.0.2 | BSD-3-Clause |
| `@protobufjs/path` | 1.1.2 | BSD-3-Clause |
| `@protobufjs/pool` | 1.1.0 | BSD-3-Clause |
| `@protobufjs/utf8` | 1.1.2 | BSD-3-Clause |
| `@redis/bloom` | 1.2.0 | MIT |
| `@redis/client` | 1.6.1 | MIT |
| `@redis/graph` | 1.1.1 | MIT |
| `@redis/json` | 1.0.7 | MIT |
| `@redis/search` | 1.2.0 | MIT |
| `@redis/time-series` | 1.1.0 | MIT |
| `@scarf/scarf` | 1.4.0 | Apache-2.0 |
| `@smithy/core` | 3.36.2 | Apache-2.0 |
| `@smithy/credential-provider-imds` | 4.5.2 | Apache-2.0 |
| `@smithy/fetch-http-handler` | 5.8.0 | Apache-2.0 |
| `@smithy/node-http-handler` | 4.12.1 | Apache-2.0 |
| `@smithy/signature-v4` | 5.7.4 | Apache-2.0 |
| `@smithy/types` | 4.19.0 | Apache-2.0 |
| `@socket.io/component-emitter` | 3.1.2 | MIT |
| `@socket.io/redis-adapter` | 8.3.0 | MIT |
| `@standard-schema/spec` | 1.1.0 | MIT |
| `@tokenizer/inflate` | 0.6.0 | MIT |
| `@tokenizer/token` | 0.3.0 | MIT |
| `@types/body-parser` | 1.19.6 | MIT |
| `@types/compression` | 1.8.1 | MIT |
| `@types/connect` | 3.4.38 | MIT |
| `@types/cors` | 2.8.19 | MIT |
| `@types/express` | 4.17.25 | MIT |
| `@types/express-serve-static-core` | 4.19.9 | MIT |
| `@types/http-errors` | 2.0.5 | MIT |
| `@types/jsonwebtoken` | 9.0.10 | MIT |
| `@types/luxon` | 3.7.2 | MIT |
| `@types/mime` | 1.3.5 | MIT |
| `@types/ms` | 2.1.0 | MIT |
| `@types/node` | 20.19.43 | MIT |
| `@types/pg` | 8.23.1 | MIT |
| `@types/qs` | 6.15.1 | MIT |
| `@types/range-parser` | 1.2.7 | MIT |
| `@types/retry` | 0.12.0 | MIT |
| `@types/send` | 0.17.6 | MIT |
| `@types/send` | 1.2.1 | MIT |
| `@types/serve-static` | 1.15.10 | MIT |
| `@types/validator` | 13.15.10 | MIT |
| `@types/ws` | 8.18.2 | MIT |
| `accepts` | 1.3.8 | MIT |
| `accepts` | 2.0.0 | MIT |
| `agent-base` | 7.1.4 | MIT |
| `ajv` | 8.20.0 | MIT |
| `anynum` | 1.0.1 | MIT |
| `append-field` | 1.0.0 | MIT |
| `argparse` | 3.0.4 | PSF-2.0 |
| `balanced-match` | 4.0.4 | MIT |
| `base64-js` | 1.5.1 | MIT |
| `bcryptjs` | 2.4.3 | MIT |
| `bignumber.js` | 9.3.1 | MIT |
| `body-parser` | 2.4.0 | MIT |
| `bowser` | 2.14.1 | MIT |
| `brace-expansion` | 5.0.12 | MIT |
| `buffer-crc32` | 1.0.0 | MIT |
| `buffer-equal-constant-time` | 1.0.1 | BSD-3-Clause |
| `busboy` | 1.6.0 | MIT |
| `bytes` | 3.1.2 | MIT |
| `cache-manager` | 7.2.9 | MIT |
| `call-bind-apply-helpers` | 1.0.2 | MIT |
| `call-bound` | 1.0.4 | MIT |
| `class-transformer` | 0.5.1 | MIT |
| `class-validator` | 0.15.1 | MIT |
| `cluster-key-slot` | 1.1.2 | Apache-2.0 |
| `color-convert` | 0.5.3 | MIT* |
| `color-diff` | 1.4.0 | BSD-3-Clause |
| `compressible` | 2.0.18 | MIT |
| `compression` | 1.8.2 | MIT |
| `content-disposition` | 2.0.1 | MIT |
| `content-type` | 2.1.0 | MIT |
| `cookie` | 0.7.2 | MIT |
| `cookie-signature` | 1.2.2 | MIT |
| `cors` | 2.8.6 | MIT |
| `cron` | 4.4.0 | MIT |
| `data-uri-to-buffer` | 4.0.1 | MIT |
| `debug` | 2.6.9 | MIT |
| `debug` | 4.3.7 | MIT |
| `debug` | 4.4.3 | MIT |
| `depd` | 2.0.0 | MIT |
| `destroy` | 1.2.0 | MIT |
| `dom-serializer` | 3.1.1 | MIT |
| `domelementtype` | 3.0.0 | BSD-2-Clause |
| `domhandler` | 6.0.1 | BSD-2-Clause |
| `domutils` | 4.0.2 | BSD-2-Clause |
| `dotenv` | 17.4.2 | BSD-2-Clause |
| `dotenv` | 18.0.3 | BSD-2-Clause |
| `dotenv-expand` | 13.0.0 | BSD-2-Clause |
| `dunder-proto` | 1.0.1 | MIT |
| `ecdsa-sig-formatter` | 1.0.11 | Apache-2.0 |
| `ee-first` | 1.1.1 | MIT |
| `encodeurl` | 2.0.0 | MIT |
| `engine.io` | 6.6.11 | MIT |
| `engine.io-parser` | 5.2.3 | MIT |
| `entities` | 8.1.0 | BSD-2-Clause |
| `es-define-property` | 1.0.1 | MIT |
| `es-errors` | 1.3.0 | MIT |
| `es-object-atoms` | 1.1.2 | MIT |
| `es-toolkit` | 1.52.0 | MIT |
| `escape-html` | 1.0.3 | MIT |
| `etag` | 1.8.1 | MIT |
| `express` | 5.3.0 | MIT |
| `extend` | 3.0.2 | MIT |
| `fast-deep-equal` | 3.1.3 | MIT |
| `fast-safe-stringify` | 2.1.1 | MIT |
| `fast-uri` | 3.1.9 | BSD-3-Clause |
| `fast-xml-builder` | 1.3.1 | MIT |
| `fast-xml-parser` | 5.12.0 | MIT |
| `fetch-blob` | 3.2.0 | MIT |
| `file-type` | 22.3.0 | MIT |
| `finalhandler` | 2.1.1 | MIT |
| `formdata-polyfill` | 4.0.10 | MIT |
| `forwarded` | 0.2.0 | MIT |
| `fresh` | 2.0.0 | MIT |
| `fs-extra` | 11.4.1 | MIT |
| `function-bind` | 1.1.2 | MIT |
| `gaxios` | 7.3.0 | Apache-2.0 |
| `gcp-metadata` | 8.1.2 | Apache-2.0 |
| `generic-pool` | 3.9.0 | MIT |
| `get-intrinsic` | 1.3.0 | MIT |
| `get-proto` | 1.0.1 | MIT |
| `glob` | 14.0.6 | BlueOak-1.0.0 |
| `google-auth-library` | 10.9.1 | Apache-2.0 |
| `google-logging-utils` | 1.1.3 | Apache-2.0 |
| `gopd` | 1.2.0 | MIT |
| `graceful-fs` | 4.2.11 | ISC |
| `has-symbols` | 1.1.0 | MIT |
| `hashery` | 1.5.1 | MIT |
| `hasown` | 2.0.4 | MIT |
| `hookified` | 1.15.1 | MIT |
| `htmlparser2` | 12.0.0 | MIT |
| `http-errors` | 2.0.1 | MIT |
| `https-proxy-agent` | 7.0.6 | MIT |
| `iconv-lite` | 0.7.3 | MIT |
| `ieee754` | 1.2.1 | BSD-3-Clause |
| `inherits` | 2.0.4 | ISC |
| `ipaddr.js` | 1.9.1 | MIT |
| `is-promise` | 4.0.0 | MIT |
| `is-unsafe` | 2.0.3 | MIT |
| `iterare` | 1.2.1 | ISC |
| `jose` | 4.15.9 | MIT |
| `js-yaml` | 5.5.0 | MIT |
| `json-bigint` | 1.0.0 | MIT |
| `json-schema-traverse` | 1.0.0 | MIT |
| `jsonfile` | 6.2.1 | MIT |
| `jsonwebtoken` | 9.0.3 | MIT |
| `jwa` | 2.0.1 | MIT |
| `jws` | 4.0.1 | MIT |
| `keyv` | 5.6.0 | MIT |
| `ldapts` | 9.2.0 | MIT |
| `libphonenumber-js` | 1.13.9 | MIT |
| `load-esm` | 1.0.3 | MIT |
| `lodash` | 4.18.1 | MIT |
| `lodash.includes` | 4.3.0 | MIT |
| `lodash.isboolean` | 3.0.3 | MIT |
| `lodash.isinteger` | 4.0.4 | MIT |
| `lodash.isnumber` | 3.0.3 | MIT |
| `lodash.isplainobject` | 4.0.6 | MIT |
| `lodash.isstring` | 4.0.1 | MIT |
| `lodash.once` | 4.1.1 | MIT |
| `long` | 5.3.2 | Apache-2.0 |
| `looks-same` | 10.0.1 | MIT |
| `lru-cache` | 11.5.3 | BlueOak-1.0.0 |
| `lru-cache` | 6.0.0 | ISC |
| `luxon` | 3.7.2 | MIT |
| `math-intrinsics` | 1.1.0 | MIT |
| `media-typer` | 0.3.0 | MIT |
| `media-typer` | 1.1.1 | MIT |
| `merge-descriptors` | 2.0.0 | MIT |
| `mime-db` | 1.52.0 | MIT |
| `mime-db` | 1.54.0 | MIT |
| `mime-types` | 2.1.35 | MIT |
| `mime-types` | 3.0.2 | MIT |
| `minimatch` | 11.0.8 | BlueOak-1.0.0 |
| `minipass` | 7.1.3 | BlueOak-1.0.0 |
| `ms` | 2.0.0 | MIT |
| `ms` | 2.1.3 | MIT |
| `multer` | 2.5.0 | MIT |
| `negotiator` | 0.6.3 | MIT |
| `negotiator` | 0.6.4 | MIT |
| `negotiator` | 1.0.0 | MIT |
| `nested-error-stacks` | 2.1.1 | MIT |
| `node-domexception` | 1.0.0 | MIT |
| `node-fetch` | 3.3.2 | MIT |
| `notepack.io` | 3.0.1 | MIT |
| `object-assign` | 4.1.1 | MIT |
| `object-hash` | 2.2.0 | MIT |
| `object-hash` | 3.0.0 | MIT |
| `object-inspect` | 1.13.4 | MIT |
| `odiff-bin` | 4.5.0 | MIT |
| `oidc-token-hash` | 5.2.0 | MIT |
| `ollama` | 0.6.4 | MIT |
| `on-finished` | 2.4.1 | MIT |
| `on-headers` | 1.1.0 | MIT |
| `once` | 1.4.0 | ISC |
| `openid-client` | 5.7.1 | MIT |
| `p-retry` | 4.6.2 | MIT |
| `package-json-from-dist` | 1.0.1 | BlueOak-1.0.0 |
| `parse-color` | 1.0.0 | MIT |
| `parseurl` | 1.3.3 | MIT |
| `passport` | 0.7.0 | MIT |
| `passport-jwt` | 4.0.1 | MIT |
| `passport-local` | 1.0.0 | MIT |
| `passport-strategy` | 1.0.0 | MIT |
| `path-expression-matcher` | 1.6.2 | MIT |
| `path-scurry` | 3.0.0 | BlueOak-1.0.0 |
| `path-to-regexp` | 8.4.2 | MIT |
| `pause` | 0.0.1 | MIT* |
| `pg` | 8.23.1 | MIT |
| `pg-cloudflare` | 1.4.1 | MIT |
| `pg-connection-string` | 2.14.1 | MIT |
| `pg-hstore` | 2.3.4 | MIT |
| `pg-int8` | 1.0.1 | ISC |
| `pg-pool` | 3.14.0 | MIT |
| `pg-protocol` | 1.16.1 | MIT |
| `pg-types` | 2.2.0 | MIT |
| `pgpass` | 1.0.5 | MIT |
| `pixelmatch` | 5.3.0 | ISC |
| `pngjs` | 6.0.0 | MIT |
| `pngjs` | 7.0.0 | MIT |
| `postgres-array` | 2.0.0 | MIT |
| `postgres-array` | 3.0.4 | MIT |
| `postgres-bytea` | 1.0.1 | MIT |
| `postgres-date` | 1.0.7 | MIT |
| `postgres-interval` | 1.2.0 | MIT |
| `protobufjs` | 7.6.5 | BSD-3-Clause |
| `proxy-addr` | 2.0.8 | MIT |
| `qs` | 6.16.1 | BSD-3-Clause |
| `range-parser` | 1.3.0 | MIT |
| `raw-body` | 3.0.2 | MIT |
| `re2js` | 2.9.1 | MIT |
| `redis` | 4.7.1 | MIT |
| `reflect-metadata` | 0.2.2 | Apache-2.0 |
| `require-from-string` | 2.0.2 | MIT |
| `retry` | 0.13.1 | MIT |
| `rimraf` | 6.1.4 | BlueOak-1.0.0 |
| `router` | 2.2.0 | MIT |
| `rxjs` | 7.8.2 | Apache-2.0 |
| `safe-buffer` | 5.2.1 | MIT |
| `safer-buffer` | 2.1.2 | MIT |
| `semver` | 7.8.5 | ISC |
| `send` | 1.2.1 | MIT |
| `serve-static` | 2.2.1 | MIT |
| `setprototypeof` | 1.2.0 | ISC |
| `side-channel` | 1.1.1 | MIT |
| `side-channel-list` | 1.0.1 | MIT |
| `side-channel-map` | 1.0.1 | MIT |
| `side-channel-weakmap` | 1.0.2 | MIT |
| `socket.io` | 4.8.4 | MIT |
| `socket.io-adapter` | 2.5.8 | MIT |
| `socket.io-parser` | 4.2.7 | MIT |
| `split2` | 4.2.0 | ISC |
| `statuses` | 2.0.2 | MIT |
| `streamsearch` | 1.1.0 | MIT |
| `strict-event-emitter-types` | 2.0.0 | ISC |
| `strnum` | 2.5.1 | MIT |
| `strtok3` | 10.7.0 | MIT |
| `swagger-ui-dist` | 5.34.0 | Apache-2.0 |
| `swagger-ui-express` | 4.6.3 | MIT |
| `toidentifier` | 1.0.1 | MIT |
| `token-types` | 6.2.0 | MIT |
| `tslib` | 2.9.1 | 0BSD |
| `type-is` | 1.6.18 | MIT |
| `type-is` | 2.1.0 | MIT |
| `uid` | 2.0.2 | MIT |
| `uid2` | 1.0.0 | MIT |
| `uint8array-extras` | 1.6.0 | MIT |
| `underscore` | 1.13.8 | MIT |
| `undici-types` | 6.21.0 | MIT |
| `universalify` | 2.0.1 | MIT |
| `unpipe` | 1.0.0 | MIT |
| `utils-merge` | 1.0.1 | MIT |
| `validator` | 13.15.35 | MIT |
| `vary` | 1.1.2 | MIT |
| `web-streams-polyfill` | 3.3.3 | MIT |
| `whatwg-fetch` | 3.6.20 | MIT |
| `wrappy` | 1.0.2 | ISC |
| `ws` | 8.21.1 | MIT |
| `xml-naming` | 0.3.0 | MIT |
| `xtend` | 4.0.2 | MIT |
| `yallist` | 4.0.0 | ISC |
| `zod` | 4.6.7 | MIT |
| `zod-to-json-schema` | 3.25.2 | ISC |

### Міграції (`backend/prisma`): 24 пакетів

| Пакет | Версія | Ліцензія |
|---|---|---|
| `@prisma/adapter-pg` | 7.10.1 | Apache-2.0 |
| `@prisma/client` | 7.10.1 | Apache-2.0 |
| `@prisma/client-runtime-utils` | 7.10.1 | Apache-2.0 |
| `@prisma/debug` | 7.10.1 | Apache-2.0 |
| `@prisma/driver-adapter-utils` | 7.10.1 | Apache-2.0 |
| `@types/node` | 24.19.2 | MIT |
| `@types/pg` | 8.23.1 | MIT |
| `bcryptjs` | 2.4.3 | MIT |
| `pg` | 8.23.1 | MIT |
| `pg-cloudflare` | 1.4.1 | MIT |
| `pg-connection-string` | 2.14.1 | MIT |
| `pg-int8` | 1.0.1 | ISC |
| `pg-pool` | 3.14.0 | MIT |
| `pg-protocol` | 1.16.1 | MIT |
| `pg-types` | 2.2.0 | MIT |
| `pgpass` | 1.0.5 | MIT |
| `postgres-array` | 2.0.0 | MIT |
| `postgres-array` | 3.0.4 | MIT |
| `postgres-bytea` | 1.0.1 | MIT |
| `postgres-date` | 1.0.7 | MIT |
| `postgres-interval` | 1.2.0 | MIT |
| `split2` | 4.2.0 | ISC |
| `undici-types` | 7.24.6 | MIT |
| `xtend` | 4.0.2 | MIT |

### Інтерфейс (`frontend`): 182 пакетів

| Пакет | Версія | Ліцензія |
|---|---|---|
| `@babel/code-frame` | 7.29.7 | MIT |
| `@babel/generator` | 7.29.8 | MIT |
| `@babel/helper-globals` | 7.29.7 | MIT |
| `@babel/helper-module-imports` | 7.29.7 | MIT |
| `@babel/helper-string-parser` | 7.29.7 | MIT |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT |
| `@babel/parser` | 7.29.9 | MIT |
| `@babel/runtime` | 7.29.10 | MIT |
| `@babel/template` | 7.29.7 | MIT |
| `@babel/traverse` | 7.29.10 | MIT |
| `@babel/types` | 7.29.8 | MIT |
| `@emotion/babel-plugin` | 11.13.5 | MIT |
| `@emotion/cache` | 11.14.0 | MIT |
| `@emotion/hash` | 0.9.2 | MIT |
| `@emotion/is-prop-valid` | 1.4.0 | MIT |
| `@emotion/memoize` | 0.9.0 | MIT |
| `@emotion/react` | 11.14.0 | MIT |
| `@emotion/serialize` | 1.3.3 | MIT |
| `@emotion/sheet` | 1.4.0 | MIT |
| `@emotion/styled` | 11.14.1 | MIT |
| `@emotion/unitless` | 0.10.0 | MIT |
| `@emotion/use-insertion-effect-with-fallbacks` | 1.2.0 | MIT |
| `@emotion/utils` | 1.4.2 | MIT |
| `@emotion/weak-memoize` | 0.4.0 | MIT |
| `@fastify/deepmerge` | 3.2.4 | MIT |
| `@floating-ui/core` | 1.8.0 | MIT |
| `@floating-ui/dom` | 1.8.0 | MIT |
| `@floating-ui/react-dom` | 2.1.9 | MIT |
| `@floating-ui/utils` | 0.2.12 | MIT |
| `@fontsource/geist-sans` | 5.2.5 | OFL-1.1 |
| `@fontsource/inter` | 5.2.5 | OFL-1.1 |
| `@fontsource/jetbrains-mono` | 5.2.5 | OFL-1.1 |
| `@fontsource/roboto` | 5.3.0 | OFL-1.1 |
| `@gilbarbara/deep-equal` | 0.4.1 | MIT |
| `@gilbarbara/hooks` | 0.11.0 | MIT |
| `@gilbarbara/types` | 0.2.2 | MIT |
| `@jridgewell/gen-mapping` | 0.3.13 | MIT |
| `@jridgewell/resolve-uri` | 3.1.0 | MIT |
| `@jridgewell/sourcemap-codec` | 1.6.0 | MIT |
| `@jridgewell/trace-mapping` | 0.3.31 | MIT |
| `@mui/core-downloads-tracker` | 5.18.0 | MIT |
| `@mui/icons-material` | 5.18.0 | MIT |
| `@mui/material` | 5.18.0 | MIT |
| `@mui/private-theming` | 5.17.1 | MIT |
| `@mui/styled-engine` | 5.18.0 | MIT |
| `@mui/styles` | 5.18.0 | MIT |
| `@mui/system` | 5.18.0 | MIT |
| `@mui/types` | 7.2.24 | MIT |
| `@mui/utils` | 5.17.1 | MIT |
| `@mui/x-data-grid` | 6.20.4 | MIT |
| `@popperjs/core` | 2.11.8 | MIT |
| `@socket.io/component-emitter` | 3.1.0 | MIT |
| `@types/parse-json` | 4.0.0 | MIT |
| `@types/prop-types` | 15.7.15 | MIT |
| `@types/react` | 18.3.31 | MIT |
| `@types/react-reconciler` | 0.28.9 | MIT |
| `@types/react-transition-group` | 4.4.12 | MIT |
| `babel-plugin-macros` | 3.1.0 | MIT |
| `call-bind-apply-helpers` | 1.0.2 | MIT |
| `call-bound` | 1.0.4 | MIT |
| `callsites` | 3.1.0 | MIT |
| `classnames` | 2.3.1 | MIT |
| `clsx` | 1.2.1 | MIT |
| `clsx` | 2.0.0 | MIT |
| `clsx` | 2.1.1 | MIT |
| `convert-source-map` | 1.8.0 | MIT |
| `cookie` | 1.1.1 | MIT |
| `core-util-is` | 1.0.3 | MIT |
| `cosmiconfig` | 7.1.0 | MIT |
| `create-react-context` | 0.3.0 | MIT |
| `css-vendor` | 2.0.8 | MIT |
| `csstype` | 3.2.3 | MIT |
| `debug` | 4.4.3 | MIT |
| `dom-helpers` | 5.2.1 | MIT |
| `dunder-proto` | 1.0.1 | MIT |
| `engine.io-client` | 6.6.7 | MIT |
| `engine.io-parser` | 5.2.3 | MIT |
| `error-ex` | 1.3.2 | MIT |
| `es-define-property` | 1.0.1 | MIT |
| `es-errors` | 1.3.0 | MIT |
| `es-object-atoms` | 1.1.2 | MIT |
| `escape-string-regexp` | 4.0.0 | MIT |
| `file-saver` | 2.0.5 | MIT |
| `find-root` | 1.1.0 | MIT |
| `function-bind` | 1.1.2 | MIT |
| `get-intrinsic` | 1.3.0 | MIT |
| `get-proto` | 1.0.1 | MIT |
| `goober` | 2.1.13 | MIT |
| `gopd` | 1.2.0 | MIT |
| `gud` | 1.0.0 | MIT |
| `has-symbols` | 1.1.0 | MIT |
| `hasown` | 2.0.4 | MIT |
| `hoist-non-react-statics` | 3.3.2 | BSD-3-Clause |
| `hyphenate-style-name` | 1.0.4 | BSD-3-Clause |
| `immediate` | 3.0.6 | MIT |
| `import-fresh` | 3.3.0 | MIT |
| `inherits` | 2.0.4 | ISC |
| `is-arrayish` | 0.2.1 | MIT |
| `is-core-module` | 2.17.0 | MIT |
| `is-in-browser` | 1.1.3 | MIT |
| `is-lite` | 2.0.0 | MIT |
| `isarray` | 1.0.0 | MIT |
| `its-fine` | 1.2.5 | MIT |
| `js-tokens` | 4.0.0 | MIT |
| `jsesc` | 3.1.0 | MIT |
| `json-parse-even-better-errors` | 2.3.1 | MIT |
| `jss` | 10.10.0 | MIT |
| `jss-plugin-camel-case` | 10.10.0 | MIT |
| `jss-plugin-default-unit` | 10.10.0 | MIT |
| `jss-plugin-global` | 10.10.0 | MIT |
| `jss-plugin-nested` | 10.10.0 | MIT |
| `jss-plugin-props-sort` | 10.10.0 | MIT |
| `jss-plugin-rule-value-function` | 10.10.0 | MIT |
| `jss-plugin-vendor-prefixer` | 10.10.0 | MIT |
| `jszip` | 3.10.2 | (MIT OR GPL-3.0-or-later) |
| `konva` | 9.3.22 | MIT |
| `lie` | 3.3.0 | MIT |
| `lines-and-columns` | 1.2.4 | MIT |
| `lodash.debounce` | 4.0.8 | MIT |
| `loose-envify` | 1.4.0 | MIT |
| `material-ui-popup-state` | 5.3.7 | MIT |
| `math-intrinsics` | 1.1.0 | MIT |
| `ms` | 2.1.3 | MIT |
| `notistack` | 3.0.2 | MIT |
| `object-assign` | 4.1.1 | MIT |
| `object-inspect` | 1.13.4 | MIT |
| `pako` | 1.0.11 | (MIT AND Zlib) |
| `parent-module` | 1.0.1 | MIT |
| `parse-json` | 5.2.0 | MIT |
| `path-parse` | 1.0.7 | MIT |
| `path-type` | 4.0.0 | MIT |
| `picocolors` | 1.1.1 | ISC |
| `process-nextick-args` | 2.0.1 | MIT |
| `promise-polyfill` | 8.1.0 | MIT |
| `prop-types` | 15.8.1 | MIT |
| `qs` | 6.16.1 | BSD-3-Clause |
| `react` | 18.3.1 | MIT |
| `react-debounce-input` | 3.3.0 | MIT |
| `react-dom` | 18.3.1 | MIT |
| `react-form-validator-core` | 1.1.2 | MIT |
| `react-hotkeys-hook` | 4.4.1 | MIT |
| `react-innertext` | 1.1.5 | MIT |
| `react-is` | 16.13.1 | MIT |
| `react-is` | 19.3.1 | MIT |
| `react-joyride` | 3.2.0 | MIT |
| `react-konva` | 18.2.16 | MIT |
| `react-lifecycles-compat` | 3.0.4 | MIT |
| `react-material-ui-form-validator` | 3.0.1 | MIT |
| `react-reconciler` | 0.29.2 | MIT |
| `react-router` | 7.18.4 | MIT |
| `react-router-dom` | 7.18.4 | MIT |
| `react-transition-group` | 4.4.5 | BSD-3-Clause |
| `readable-stream` | 2.3.7 | MIT |
| `reselect` | 4.1.8 | MIT |
| `resolve` | 1.22.4 | MIT |
| `resolve-from` | 4.0.0 | MIT |
| `safe-buffer` | 5.1.2 | MIT |
| `scheduler` | 0.23.2 | MIT |
| `scroll` | 3.0.1 | MIT |
| `scrollparent` | 2.1.0 | ISC |
| `set-cookie-parser` | 2.7.3 | MIT |
| `setimmediate` | 1.0.5 | MIT |
| `side-channel` | 1.1.1 | MIT |
| `side-channel-list` | 1.0.1 | MIT |
| `side-channel-map` | 1.0.1 | MIT |
| `side-channel-weakmap` | 1.0.2 | MIT |
| `socket.io-client` | 4.8.4 | MIT |
| `socket.io-parser` | 4.2.7 | MIT |
| `source-map` | 0.5.7 | BSD-3-Clause |
| `string_decoder` | 1.1.1 | MIT |
| `stylis` | 4.2.0 | MIT |
| `supports-preserve-symlinks-flag` | 1.0.0 | MIT |
| `tiny-warning` | 1.0.3 | MIT |
| `type-fest` | 4.41.0 | (MIT OR CC0-1.0) |
| `use-image` | 1.1.4 | MIT |
| `use-sync-external-store` | 1.7.0 | MIT |
| `util-deprecate` | 1.0.2 | MIT |
| `uuid` | 14.0.0 | MIT |
| `warning` | 4.0.3 | MIT |
| `ws` | 8.21.3 | MIT |
| `xmlhttprequest-ssl` | 2.1.2 | MIT |
| `yaml` | 1.10.3 | ISC |

## Як рахували

Із `package-lock.json` пакетів `backend`, `backend/prisma` і `frontend` взято всі пакети без позначки
`dev`, крім тих, що видаляються під час збирання (`prisma`, `@prisma/studio-core`, `elkjs`). Ліцензія —
з lock-файла, а де її там немає — зі звіту `license-checker` (`audit/raw/licenses-*-prod-2026-11-09.json`).
`deepmerge` — копія в `vendor/` під MIT з однією зміною (її `README.md`). Пакет `sdk-playwright` залежностей
часу виконання не має.

Перелік відповідає lock-файлам на момент передачі. Після оновлення залежностей його треба
порахувати знову; повторний аудит ліцензій — у [SAST-звіті](../../audit/report-sast-2026-11-09.md).
