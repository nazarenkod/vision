import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform, ValidationPipe } from '@nestjs/common';
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

/**
 * Refuses a list longer than its DTO's `@ArrayMaxSize` before anything looks inside it.
 * ValidationPipe checks every element of a nested list first: 100 000 ignore areas held the API
 * for seconds before the limit said no (051, VIS-SEC-005). Same message as class-validator's.
 */
@Injectable()
export class ListLengthPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' || metadata.data !== undefined) return value;
    if (!value || typeof value !== 'object' || typeof metadata.metatype !== 'function') return value;
    const limits = getMetadataStorage()
      .getTargetValidationMetadatas(metadata.metatype, '', true, false)
      .filter((rule) => rule.name === 'arrayMaxSize');
    for (const rule of limits) {
      const list = (value as Record<string, unknown>)[rule.propertyName];
      const max = Number(rule.constraints?.[0]);
      if (Array.isArray(list) && list.length > max) {
        throw new BadRequestException([`${rule.propertyName} must contain no more than ${max} elements`]);
      }
    }
    return value;
  }
}

/** The pipes every request goes through, in order: the API and the e2e tests set up the same. */
export const globalPipes = (): PipeTransform[] => [
  new ListLengthPipe(),
  new ValidationPipe(),
  new StripUnknownFieldsPipe(),
];
