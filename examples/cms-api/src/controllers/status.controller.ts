import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config';
import { pkg } from '../utils/environment';
import { StatusResponseDto } from '../dto/status.dto';

@ApiTags('status')
@Controller('status')
export class StatusController {
    private readonly logger = new Logger(StatusController.name);
    constructor(
        private readonly configService: ConfigService<AppConfig>,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Check server status' })
    @ZodResponse({ status: 200, description: 'Server is up.', type: StatusResponseDto })
    async status() {
        this.logger.log('status');
        return {
            version: pkg.version,
            build_id: this.configService.getOrThrow('BUILD_ID')
        };
    }
}