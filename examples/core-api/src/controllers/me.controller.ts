import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Session, type UserSession } from '@trailmix-cms/core/better-auth';

import { MeResponseDto } from '../dto/me.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
    /**
     * Returns the authenticated user and session.
     *
     * No explicit guard is needed: the Trailmix core setup registers better-auth's
     * `AuthGuard` globally, so every route is protected unless marked `@AllowAnonymous()`.
     */
    @Get()
    @ApiOperation({ summary: 'Return the current authenticated user and session' })
    @ZodResponse({ status: 200, description: 'The authenticated user and session.', type: MeResponseDto })
    me(@Session() session: UserSession) {
        return {
            user: session.user,
            session: session.session,
        };
    }
}
