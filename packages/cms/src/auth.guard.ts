import { Reflector } from '@nestjs/core';
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import * as trailmixModels from '@trailmix-cms/models';
import { ALLOW_ANONYMOUS_KEY, PRINCIPAL_TYPES_KEY, ROLES_KEY } from './decorators/auth.decorator';
import { AuthResult, AuthService } from './services/auth.service';
import { type RequestPrincipal } from './types';

declare module 'fastify' {
    interface FastifyRequest {
        principal: RequestPrincipal
    }
}

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private authService: AuthService,
    ) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const requiredGlobalRoles = this.reflector.getAllAndOverride<(trailmixModels.RoleValue | string)[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const allowAnonymous = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const requiredPrincipalTypes = this.reflector.getAllAndOverride<trailmixModels.Principal[]>(PRINCIPAL_TYPES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const requestUrl = request.url;

        const principal = await this.authService.getPrincipal(context);
        const authResult = await this.authService.validateAuth(
            principal,
            allowAnonymous,
            requiredPrincipalTypes,
            requiredGlobalRoles,
            requestUrl,
        );

        if (authResult !== AuthResult.IsValid) {
            if (authResult === AuthResult.Unauthorized) {
                throw new UnauthorizedException('Unauthorized request');
            }
            if (authResult === AuthResult.Forbidden) {
                throw new ForbiddenException('You are not authorized to access this resource');
            }
            throw new InternalServerErrorException('Failed to validate authentication');
        }

        request.principal = principal!;
        return true;
    }
}