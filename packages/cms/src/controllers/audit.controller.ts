import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger';

import { RoleValue } from '@trailmix-cms/models';
import { DatabaseService, Collections } from '@trailmix-cms/db';
import { validateObjectId } from '@trailmix-cms/utils';

import { Auth } from '../decorators/auth.decorator';
import * as dto from '../dto/audit.dto';

@Auth({ globalRoles: [RoleValue.Admin] })
@ApiTags('audit')
@Controller('audit')
export class AuditController {
    private readonly logger = new Logger(AuditController.name);

    constructor(
        private readonly auditCollection: Collections.AuditCollection,
        private readonly databaseService: DatabaseService,
    ) { }

    @Get(':type/:id')
    @ApiParam({ name: 'type', description: 'Entity type' })
    @ApiParam({ name: 'id', description: 'Entity ID' })
    @ApiOperation({ summary: 'Get audit history for a record' })
    @ApiOkResponse({
        description: 'Audit record found.',
        type: dto.AuditListResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Audit record not found.' })
    async getAuditRecord(
        @Param('type') type: string,
        @Param('id') id: string
    ): Promise<dto.AuditListResponseDto> {
        this.logger.log(`Getting audit history for entity type: ${type} and entity ID: ${id}`);

        // Check if the collection type exists in MongoDB
        const collections = await this.databaseService.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        if (!collectionNames.includes(type)) {
            this.logger.warn(`Collection type '${type}' does not exist.`);
        }

        const entityId = validateObjectId(id, { type: 'param', data: 'id' });
        const result = await this.auditCollection.find({
            entity_type: type,
            entity_id: entityId
        });
        return {
            items: result,
            count: result.length,
        };
    }
}

