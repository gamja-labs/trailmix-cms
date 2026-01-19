import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ApiKey, ApiKeyScope, Codecs, InternalFields } from '@trailmix-cms/models';

export const CreateApiKeySchema = ApiKey.schema.omit(InternalFields);
export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) { }

export const ApiKeyListQuerySchema = z.object({
    name: z.string().optional(),
    disabled: z.boolean().optional(),
    scope_type: z.enum(Object.values(ApiKeyScope)).optional(),
    scope_id: Codecs.ObjectId.optional(),
});
export class ApiKeyListQueryDto extends createZodDto(ApiKeyListQuerySchema) { }

export const ApiKeyListResponseSchema = z.object({
    items: z.array(ApiKey.schema),
    count: z.number(),
});
export class ApiKeyListResponseDto extends createZodDto(ApiKeyListResponseSchema) { }
