import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ApiKey, ApiKeyScope, Codecs, InternalFields } from '@trailmix-cms/models';

export const CreateApiKeySchema = ApiKey.schema.omit({ ...InternalFields, api_key: true });
export type CreateApiKeySchema = z.input<typeof CreateApiKeySchema>;
export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema, { codec: true }) { }

export const ApiKeyResponseSchema = ApiKey.schema;
export type ApiKeyResponseSchema = z.input<typeof ApiKeyResponseSchema>;
export class ApiKeyResponseDto extends createZodDto(ApiKeyResponseSchema, { codec: true }) { }

export const ApiKeyListQuerySchema = z.object({
    name: z.string().optional(),
    disabled: z.boolean().optional(),
    scope_type: z.enum(Object.values(ApiKeyScope)).optional(),
    scope_id: Codecs.ObjectId.optional(),
});
export type ApiKeyListQuerySchema = z.input<typeof ApiKeyListQuerySchema>;
export class ApiKeyListQueryDto extends createZodDto(ApiKeyListQuerySchema, { codec: true }) { }

export const ApiKeyListResponseSchema = z.object({
    items: z.array(ApiKey.schema),
    count: z.number(),
});
export type ApiKeyListResponseSchema = z.input<typeof ApiKeyListResponseSchema>;
export class ApiKeyListResponseDto extends createZodDto(ApiKeyListResponseSchema, { codec: true }) { }
