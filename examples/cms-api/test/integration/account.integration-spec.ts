import { Dto } from '@trailmix-cms/cms';
import * as dto from '../../src/dto';
import { createTestContext, teardownTestContext, TestContext } from './setup';

describe('Account Integration Tests', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('GET /account', () => {
        it('should return the current account info', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: '/account' });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.AccountResponseSchema>();
            expect(body._id).toBe(ctx.testAccountId.toHexString());
            expect(body.user_id).toBeDefined();
            expect(body.created_at).toBeDefined();
        });
    });

    describe('GET /account/global-roles', () => {
        it('should return empty global roles for a non-admin account', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: '/account/global-roles' });
            expect(res.statusCode).toBe(200);

            const body = res.json<Dto.AccountGlobalRoleListResponseSchema>();
            expect(body.items).toBeInstanceOf(Array);
            expect(body.count).toBe(0);
        });
    });
});
