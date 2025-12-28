import { Reflector } from '@nestjs/core';
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger, ForbiddenException, InternalServerErrorException, Inject, Optional } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAuth, createClerkClient, ClerkClient } from '@clerk/fastify';
import { Account, Role } from '@trailmix-cms/models';
import { AccountCollection } from './collections';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from './config';
import { ALLOW_ANONYMOUS_KEY, ROLES_KEY } from './decorators/auth.decorator';
import { AccountService } from './services/account.service';
import { PROVIDER_SYMBOLS } from './constants';
import { AuthGuardHook } from './auth-guard-hook';

declare module 'fastify' {
    interface FastifyRequest {
        account?: Account.Entity
    }
}

@Injectable()
export class AuthGuard implements CanActivate {
    private readonly logger = new Logger(AuthGuard.name);
    private readonly clerkClient: ClerkClient;

    constructor(
        private reflector: Reflector,
        private accountService: AccountService,
        private configService: ConfigService<AppConfig>,
        @Optional() @Inject(PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_AUTH_GUARD_HOOK) private authGuardHook?: AuthGuardHook,
    ) {
        this.clerkClient = createClerkClient({
            secretKey: this.configService.get('CLERK_SECRET_KEY'),
        });
    }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const allowAnonymous = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const request = context.switchToHttp().getRequest<FastifyRequest>();

        const { account } = await this.getAccount(context);

        if (!account) {
            if (allowAnonymous) {
                return true;
            }
            throw new UnauthorizedException('Unauthorized request');
        }

        request.account = account;

        if (allowAnonymous) {
            return true;
        }

        // If no roles are required, allow any authenticated user
        if (requiredRoles.length == 0) {
            return true;
        }

        // Check if user has required role
        const hasRole = requiredRoles.some((role) => account?.roles?.includes(role))
            || account?.roles?.includes(Role.Admin);
        if (!hasRole) {
            throw new ForbiddenException('You are not authorized to access this resource');
        }

        return true;
    }

    private async getAccount(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<FastifyRequest>();

        const auth = getAuth(request)

        if (!auth.userId) {
            return {};
        }

        // TODO: Cache user
        // const cachedUser = await this.userCache.getUser(auth.userId);
        // if (cachedUser) {
        //     return {
        //         account: cachedUser.account,
        //         userPublicMetadata: cachedUser.metadata,
        //     };
        // }

        const user = await this.clerkClient.users.getUser(auth.userId)
        const accountExists = await this.accountService.getAccount(auth.userId);
        if (accountExists) {
            return {
                account: accountExists,
                userPublicMetadata: user.publicMetadata,
            };
        }

        const account = await this.accountService.upsertAccount(auth.userId);

        // TODO: Lock this step to prevent race conditions
        if (this.authGuardHook) {
            const authGuardHookresult = await this.authGuardHook.onHook(account!);
            if (!authGuardHookresult) {
                this.logger.error('Failed to validate account using auth guard hook', {
                    userId: auth.userId,
                    accountId: account?._id,
                });
                throw new InternalServerErrorException('Failed to validate account using auth guard hook');
            }
        }

        // TODO: Cache user
        // await this.userCache.cacheUser(auth.userId, {
        //     account: account!,
        //     metadata: user.publicMetadata,
        // });

        return {
            account,
            userPublicMetadata: user.publicMetadata,
        };
    }
}