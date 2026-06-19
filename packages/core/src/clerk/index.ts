export * from './config.js';
export * from './constants.js';
export * from './provider-symbols.js';
export * from './provider-helpers.js';
export * from './types/index.js';
export * from './decorators/index.js';
export * from './auth.guard.js';
export * from './collections/index.js';
export * from './services/index.js';
export * from './managers/index.js';
export * from './pipes/index.js';
export * from './controllers/index.js';
export * from './module.js';
export * as Dto from './dto/index.js';

// Convenience re-exports so consumers can register Clerk and read auth from one place.
export { clerkPlugin, getAuth } from '@clerk/fastify';
