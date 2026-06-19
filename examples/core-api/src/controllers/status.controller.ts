import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { AllowAnonymous } from '@trailmix-cms/core/better-auth';

import { pkg } from '../utils/environment';
import { StatusResponseDto } from '../dto/status.dto';

@ApiTags('status')
@Controller('status')
export class StatusController {
    @Get()
    @AllowAnonymous()
    @ApiOperation({ summary: 'Public health check' })
    @ZodResponse({ status: 200, description: 'Server is up.', type: StatusResponseDto })
    status() {
        return {
            status: 'ok',
            version: pkg.version,
        };
    }
}
