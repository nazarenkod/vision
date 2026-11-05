import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import compression from 'compression';
import { readFileSync, existsSync } from 'fs';
import { HttpsOptions } from '@nestjs/common/interfaces/external/https-options.interface';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RedisIoAdapter } from './redis-io.adapter';
import { serverSecretKey } from './shared/secret-box';
import { allowOwnInterface, securityHeaders, swaggerEnabled } from './security';

function getHttpsOptions(): HttpsOptions | null {
  const keyPath = './secrets/ssl.key';
  const certPath = './secrets/ssl.cert';
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    Logger.log('HTTPS config not found. Fall back to HTTP');
    return null;
  }
  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}

async function bootstrap() {
  // before anything else: without the key, stored tokens could be neither sealed nor read (044)
  try {
    serverSecretKey();
  } catch (error) {
    Logger.error((error as Error).message, 'Bootstrap');
    process.exit(1);
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // only Vision's own interface reads answers in a browser (045); the public report reads its ETag
    cors: { origin: allowOwnInterface, exposedHeaders: ['ETag'] },
    httpsOptions: getHttpsOptions(),
  });
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.useGlobalPipes(new ValidationPipe());

  // Large builds return multi-megabyte test-run lists; gzip shrinks them ~10x.
  // Images are already-compressed PNGs — recompressing them wastes CPU.
  // Must be registered before any routes (incl. swagger) to cover them.
  app.use(
    compression({ filter: (req, res) => compression.filter(req, res) && res.getHeader('Content-Type') !== 'image/png' })
  );

  // the API documentation only where it is turned on (045)
  if (swaggerEnabled()) setupSwagger(app);

  // Fan out socket.io events across API instances when running multiple
  // replicas. Without REDIS_URL the default in-memory adapter is used.
  await RedisIoAdapter.use(app, process.env.REDIS_URL);

  if (process.env.BODY_PARSER_JSON_LIMIT) {
    app.use(bodyParser.json({ limit: process.env.BODY_PARSER_JSON_LIMIT }));
  }

  // no folder of stored files is served as it is: images go through /images with a signature (043)
  await app.listen(process.env.APP_PORT || 3000);
}
bootstrap();
