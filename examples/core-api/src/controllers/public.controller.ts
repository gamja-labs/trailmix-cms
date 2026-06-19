import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { OptionalAuth, Session, type UserSession } from '@trailmix-cms/core/better-auth';

import { GreetingResponseDto } from '../dto/public.dto';

/**
 * Demonstrates `@OptionalAuth()`: the global `AuthGuard` lets the request through whether or
 * not there's a session, so `@Session()` is either the user's session or `null`.
 */
@ApiTags('public')
@Controller('public')
export class PublicController {
    @Get('greeting')
    @OptionalAuth()
    @ApiOperation({ summary: 'Greeting — personalized when signed in, generic otherwise' })
    @ZodResponse({ status: 200, description: 'Greeting message.', type: GreetingResponseDto })
    greeting(@Session() session: UserSession | null) {
        if (!session) {
            return { authenticated: false, message: 'Hello, stranger!' };
        }
        return { authenticated: true, message: `Hello, ${session.user.name ?? session.user.email}!` };
    }
}
