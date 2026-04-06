import * as dto from '../../src/dto';
import { createTestContext, teardownTestContext, TestContext } from './setup';

describe('Status Integration Tests', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('GET /status', () => {
        it('should return version and build_id', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: '/status' });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.StatusResponseSchema>();
            expect(body.version).toBeDefined();
            expect(body.build_id).toBe('integration-test');
        });
    });
});
