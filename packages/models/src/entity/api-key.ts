import { z } from 'zod';
import { baseEntitySchema } from '../base';
import * as Codecs from '../utils/codecs';
import { ApiKeyScope } from '../types';

export const schema = baseEntitySchema.extend({
    api_key: z.string(), // The generated API key
    name: z.string().optional(), // Optional name/description for the API key
    disabled: z.boolean().optional(), // Whether the API key is disabled
    expires_at: Codecs.DateTime.optional(), // Optional expiration date for the API key
    scope_type: z.enum(Object.values(ApiKeyScope)),
    scope_id: Codecs.ObjectId.optional(), // Optional scope ID for the API key
}).meta({
    id: 'ApiKey',
});

export type Entity = z.infer<typeof schema>;

