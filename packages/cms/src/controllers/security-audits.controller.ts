import { Controller, Get, Param, Query, Logger, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiNotFoundResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

import { Auth } from '../decorators/auth.decorator';
import { Principal, RoleValue } from '@trailmix-cms/models';
import { SecurityAuditCollection } from '../collections/security-audit.collection';
import { validateObjectId } from '@trailmix-cms/utils';

import * as dto from '../dto/security-audit.dto';
import * as trailmixModels from '@trailmix-cms/models';

@Auth({ requiredGlobalRoles: [RoleValue.Admin], requiredPrincipalTypes: [Principal.Account, Principal.ApiKey] })
@ApiTags('security-audits')
@Controller('security-audits')
export class SecurityAuditsController {
    private readonly logger = new Logger(SecurityAuditsController.name);

    constructor(
        private readonly securityAuditCollection: SecurityAuditCollection,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all security audit records' })
    @ApiQuery({ name: 'principal_id', required: false, description: 'Filter by principal ID' })
    @ApiQuery({ name: 'principal_type', required: false, description: 'Filter by principal type', enum: trailmixModels.Principal })
    @ApiQuery({ name: 'event_type', required: false, description: 'Filter by event type', enum: trailmixModels.SecurityAuditEventType })
    @ApiOkResponse({
        description: 'Security audit records found.',
        type: dto.SecurityAuditListResponseDto,
    })
    async getSecurityAudits(
        @Query() queryParams: dto.GetSecurityAuditsQueryDto,
    ): Promise<dto.SecurityAuditListResponseDto> {
        this.logger.log(`Getting security audit records with query: ${JSON.stringify(queryParams)}`);

        const filter: {
            principal_id?: ObjectId;
            principal_type?: trailmixModels.Principal;
            event_type?: trailmixModels.SecurityAuditEventType;
        } = {};

        if (queryParams.principal_id) {
            filter.principal_id = queryParams.principal_id;
        }
        if (queryParams.principal_type) {
            filter.principal_type = queryParams.principal_type;
        }
        if (queryParams.event_type) {
            filter.event_type = queryParams.event_type;
        }

        const audits = await this.securityAuditCollection.find(filter, {
            sort: { created_at: -1 },
        });

        return {
            items: audits,
            count: audits.length,
        };
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'Security audit record ID' })
    @ApiOperation({ summary: 'Get a specific security audit record by ID' })
    @ApiOkResponse({
        description: 'Security audit record found.',
        type: dto.SecurityAuditResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Security audit record not found.' })
    async getSecurityAuditById(
        @Param('id') id: string,
    ): Promise<trailmixModels.SecurityAudit.Entity> {
        this.logger.log(`Getting security audit record ${id}`);

        const auditId = validateObjectId(id, { type: 'param', data: 'id' });
        const audit = await this.securityAuditCollection.get(auditId);

        if (!audit) {
            throw new NotFoundException('Security audit record not found');
        }

        return audit;
    }
}
