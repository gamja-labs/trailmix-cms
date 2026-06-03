import type { ZodType } from 'zod';

/**
 * Validates `value` by running the schema's encoder for its throwing side
 * effect. `schema.encode()` throws a `ZodError` on invalid input and returns an
 * (always-truthy) encoded value on success, so the older `!!schema.encode(x)`
 * guard could never trip. This re-throws any failure as a clearer `Error` that
 * preserves the underlying validation message.
 */
export function encodeOrThrow(schema: ZodType, value: unknown, message: string): void {
    try {
        schema.encode(value as never);
    } catch (error) {
        throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
