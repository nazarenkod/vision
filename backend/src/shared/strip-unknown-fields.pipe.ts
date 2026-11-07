import { ArgumentMetadata, Injectable, PipeTransform, ValidationPipe } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';

/**
 * The fields a request body class declares: those with a class-validator decorator, its parents'
 * included. Null when the class declares none (not a DTO, or a primitive such as String).
 */
export function declaredFields(metatype: unknown): ReadonlySet<string> | null {
  if (typeof metatype !== 'function') return null;
  const fields = getMetadataStorage()
    .getTargetValidationMetadatas(metatype, '', true, false)
    .map((metadata) => metadata.propertyName);
  return fields.length ? new Set(fields) : null;
}

/**
 * Drops the keys of a request body its DTO does not declare (VIS-SEC-012). A service that hands
 * the DTO to Prisma would write every key, nested writes included, as with `user.update` on a
 * build (VIS-SEC-001). Unknown keys are dropped, not refused: released SDKs keep sending fields
 * Vision no longer reads, and their requests must keep working (rule 5).
 *
 * Unlike ValidationPipe's `whitelist`, the body is not sent through class-transformer and back:
 * that round trip runs each `@Transform` again on its own output (the multipart upload's
 * `merge` turned false, its `ignoreAreas` failed to parse).
 */
@Injectable()
export class StripUnknownFieldsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' || metadata.data !== undefined) return value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const declared = declaredFields(metadata.metatype);
    if (!declared) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => declared.has(key)));
  }
}

/** The pipes every request goes through, in order: the API and the e2e tests set up the same. */
export const globalPipes = (): PipeTransform[] => [new ValidationPipe(), new StripUnknownFieldsPipe()];
