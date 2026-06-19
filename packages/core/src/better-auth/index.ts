export * from './module.js';
export * from './auth.js';
export * from './config.js';
export * from './openapi.js';
export * from './admin.guard.js';

// Re-export the better-auth NestJS decorators / guards / services for convenience so
// consumers can pull everything they need from a single package.
export * from '@thallesp/nestjs-better-auth';
