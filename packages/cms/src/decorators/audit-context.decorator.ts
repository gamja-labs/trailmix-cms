import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import * as models from '@trailmix-cms/models';
import { RequestPrincipal } from '../types';

export const AuditContext = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest<FastifyRequest>();
        if (!request.principal) {
            // TODO: Log this error
            throw new InternalServerErrorException('No principal found in request');
        }
        const auditContext: models.AuditContext.Model = {
            principal_id: request.principal.entity._id,
            principal_type: request.principal.principal_type,
            system: false,
        };
        return auditContext;
    },
);


export function createAuditContextForPrincipal(requestPrincipal: RequestPrincipal) {
    return {
        principal_id: requestPrincipal.entity._id,
        principal_type: requestPrincipal.principal_type,
        system: false,
    };
}