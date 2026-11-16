import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export const API_TITLE = 'Vision';

export function setupSwagger(app: INestApplication) {
  const options = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setDescription('API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'apiKey', in: 'header', description: 'API Key For External calls' })
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);
}
