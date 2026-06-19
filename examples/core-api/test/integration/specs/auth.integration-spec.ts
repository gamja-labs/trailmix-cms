import { ObjectId } from 'mongodb';

import { createTestContext, teardownTestContext, TestContext } from '../setup';
import {
    Session,
    signUp,
    signIn,
    createOrganization,
    setActiveOrganization,
    uniqueEmail,
} from '../helpers';

const PASSWORD = 'Sup3rSecret!pw';

describe('core-api auth integration', () => {
    let ctx: TestContext;

    /** A fresh, cookie-isolated client for a given user. */
    const session = () => new Session(ctx.baseUrl);

    /** Sign a brand-new user up and return their authenticated client. */
    const signedUpUser = async (prefix: string) => {
        const email = uniqueEmail(prefix);
        const s = session();
        const res = await signUp(s, { email, password: PASSWORD });
        expect(res.status).toBe(200);
        return { email, session: s };
    };

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('better-auth sign-up / sign-in (email + password)', () => {
        it('signs a user up, auto-signs them in, and authenticates protected routes', async () => {
            const email = uniqueEmail('signup');
            const s = session();

            const res = await signUp(s, { email, password: PASSWORD });
            expect(res.status).toBe(200);
            expect((await res.json()).user.email).toBe(email);
            expect(s.hasSessionCookie).toBe(true);

            // The user landed in Mongo.
            const stored = await ctx.db.collection('user').findOne({ email });
            expect(stored).not.toBeNull();

            // The session cookie satisfies the global AuthGuard on GET /me.
            const me = await s.request('GET', '/me');
            expect(me.status).toBe(200);
            expect((await me.json()).user.email).toBe(email);
        });

        it('rejects unauthenticated access to a guarded route (401)', async () => {
            const res = await session().request('GET', '/me');
            expect(res.status).toBe(401);
        });

        it('signs an existing user in and rejects a wrong password', async () => {
            const email = uniqueEmail('signin');
            await signUp(session(), { email, password: PASSWORD });

            const ok = await signIn(session(), { email, password: PASSWORD });
            expect(ok.status).toBe(200);

            const bad = await signIn(session(), { email, password: 'wrong-password' });
            expect(bad.status).toBe(401);
        });

        it('@OptionalAuth lets the public route through with and without a session', async () => {
            const anon = await session().request('GET', '/public/greeting');
            expect(anon.status).toBe(200);
            expect((await anon.json()).authenticated).toBe(false);

            const { session: s } = await signedUpUser('public');
            const authed = await s.request('GET', '/public/greeting');
            expect(authed.status).toBe(200);
            expect((await authed.json()).authenticated).toBe(true);
        });
    });

    describe("@Roles(['admin']) — system-level admin decorator", () => {
        it('forbids a regular user from the admin route (403)', async () => {
            const { session: s } = await signedUpUser('notadmin');

            const res = await s.request('GET', '/admin/overview');
            expect(res.status).toBe(403);
        });

        it("admits a user once their better-auth user.role is admin (200)", async () => {
            const { email, session: s } = await signedUpUser('admin');

            // Promote via the admin-plugin role field on the user document. getSession reads the
            // role fresh from Mongo, so the existing session cookie now passes @Roles(['admin']).
            await ctx.db.collection('user').updateOne({ email }, { $set: { role: 'admin' } });

            const res = await s.request('GET', '/admin/overview');
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.role).toBe('admin');
            expect(body.you).toBe(email);
        });
    });

    describe("@OrgRoles(['owner', 'admin']) — organization-scoped decorator", () => {
        it('forbids a signed-in user with no active organization (403)', async () => {
            const { session: s } = await signedUpUser('noorg');

            const res = await s.request('GET', '/organizations/active/settings');
            expect(res.status).toBe(403);
        });

        it('admits the org owner of the active organization (200)', async () => {
            const { session: s } = await signedUpUser('owner');

            const slug = `org-${Date.now().toString(36)}`;
            const created = await createOrganization(s, { name: 'Acme', slug });
            expect(created.status).toBe(200);
            const organizationId = (await created.json()).id as string;
            expect(organizationId).toBeDefined();

            // better-auth auto-activates a freshly created org on the creator's session; an explicit
            // set-active is idempotent and confirms the endpoint works.
            const activated = await setActiveOrganization(s, organizationId);
            expect(activated.status).toBe(200);

            // The creator is the org owner, so @OrgRoles(['owner','admin']) passes.
            const res = await s.request('GET', '/organizations/active/settings');
            expect(res.status).toBe(200);
            expect((await res.json()).activeOrganizationId).toBe(organizationId);
        });

        it('forbids a plain member (no owner/admin org role) from the owner/admin route (403)', async () => {
            // Owner creates an org.
            const { session: owner } = await signedUpUser('org-owner');
            const slug = `member-org-${Date.now().toString(36)}`;
            const created = await createOrganization(owner, { name: 'Members Inc', slug });
            const organizationId = (await created.json()).id as string;

            // A second user is added directly as a plain `member` of that org, then activates it.
            // better-auth's mongo adapter stores references as ObjectId, so the membership row must
            // use ObjectId values for set-active's membership lookup to find it.
            const { email: memberEmail, session: member } = await signedUpUser('org-member');
            const memberUser = await ctx.db.collection('user').findOne({ email: memberEmail });
            await ctx.db.collection('member').insertOne({
                _id: new ObjectId(),
                organizationId: new ObjectId(organizationId),
                userId: memberUser!._id,
                role: 'member',
                createdAt: new Date(),
            });
            const activated = await setActiveOrganization(member, organizationId);
            expect(activated.status).toBe(200);

            const res = await member.request('GET', '/organizations/active/settings');
            expect(res.status).toBe(403);
        });
    });
});
