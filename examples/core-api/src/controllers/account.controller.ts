import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { AuthService } from '@trailmix-cms/core/better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';

import { WhoamiResponseDto } from '../dto/account.dto';

/** The user/session better-auth attaches to the request after the AuthGuard resolves it. */
type AuthedRequest = FastifyRequest & {
    user?: { id: string; email: string };
    session?: { session?: { id: string } };
};

/**
 * Demonstrates two more features:
 *  - **Request-object access** — better-auth attaches `req.user` / `req.session`.
 *  - **`AuthService`** — call the better-auth server API directly on `.api`, forwarding the
 *    request headers.
 */
@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
    constructor(private readonly authService: AuthService) {}

    @Get('whoami')
    @ApiOperation({ summary: 'Read the user/session attached to the request object' })
    @ZodResponse({ status: 200, description: 'The user/session on the request.', type: WhoamiResponseDto })
    whoami(@Req() req: AuthedRequest) {
        return { userId: req.user?.id, email: req.user?.email, sessionId: req.session?.session?.id };
    }

    @Get('sessions')
    @ApiExcludeEndpoint() // dynamic better-auth response shape; omit from the static spec
    listSessions(@Req() req: FastifyRequest) {
        return this.authService.api.listSessions({ headers: fromNodeHeaders(req.headers) });
    }

    @Get('accounts')
    @ApiExcludeEndpoint()
    listAccounts(@Req() req: FastifyRequest) {
        return this.authService.api.listUserAccounts({ headers: fromNodeHeaders(req.headers) });
    }
}
