import { Injectable } from '@nestjs/common';

/**
 * Class decorator that replaces a service with an inert stub when the app runs
 * in OpenAPI spec-generation mode (GENERATE_SPEC=true).
 */
export function StubServiceWhenGeneratingSpec() {
    return <T extends new (...args: any[]) => object>(target: T): T => {
        if (process.env.GENERATE_SPEC !== 'true') return target;

        @Injectable()
        class Stub {}

        for (const key of Object.getOwnPropertyNames(target.prototype)) {
            if (key === 'constructor') continue;
            Object.defineProperty(Stub.prototype, key, {
                value: async () => undefined,
                writable: true,
                configurable: true,
            });
        }

        // Keep the original name so Nest's logs/errors stay readable.
        Object.defineProperty(Stub, 'name', { value: target.name });
        return Stub as unknown as T;
    };
}
