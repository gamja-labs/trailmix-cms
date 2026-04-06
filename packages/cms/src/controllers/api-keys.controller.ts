import { Controller, Get, Post, Delete, Body, Param, Query, Optional } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import * as trailmixModels from '@trailmix-cms/models';

import { Auth, AuditContext, PrincipalContext } from '../decorators';
import * as dto from '../dto/api-key.dto';
import { type RequestPrincipal } from '../types';
import { ApiKeyService } from '../services/api-key.service';
import { ApiKeyByIdPipe } from '../pipes/api-key.pipe';

@Auth({ requiredPrincipalTypes: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey] })
@ApiTags('api-keys')
@Controller('api-keys')
export class ApiKeysController {
    constructor(
        private readonly apiKeyService: ApiKeyService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new API key' })
    @ZodResponse({ status: 201, description: 'API key created successfully.', type: dto.ApiKeyResponseDto })
    async createApiKey(
        @Body() body: dto.CreateApiKeyDto,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: trailmixModels.AuditContext.Model,
    ) {
        return await this.apiKeyService.createApiKey(body, principal, auditContext);
    }

    @Get()
    @ApiOperation({ summary: 'Get all API keys' })
    @ZodResponse({ status: 200, description: 'API keys found.', type: dto.ApiKeyListResponseDto })
    async getApiKeys(
        @PrincipalContext() principal: RequestPrincipal,
        @Query() queryParams: dto.ApiKeyListQueryDto,
    ) {
        return await this.apiKeyService.getApiKeys(principal, queryParams);
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'API key ID' })
    @ApiOperation({ summary: 'Get an API key by ID' })
    @ZodResponse({ status: 200, description: 'API key found.', type: dto.ApiKeyResponseDto })
    async getApiKey(
        @Param('id', ApiKeyByIdPipe) apiKey: trailmixModels.ApiKey.Entity,
        @PrincipalContext() principal: RequestPrincipal,
    ) {
        return await this.apiKeyService.getApiKey(apiKey, principal);
    }

    @Delete(':id')
    @ApiParam({ name: 'id', description: 'API key ID' })
    @ApiOperation({ summary: 'Delete an API key by ID' })
    @ApiOkResponse({ description: 'API key deleted successfully.' })
    async deleteApiKey(
        @Param('id', ApiKeyByIdPipe) apiKey: trailmixModels.ApiKey.Entity,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: trailmixModels.AuditContext.Model,
    ): Promise<void> {
        await this.apiKeyService.deleteApiKey(apiKey, principal, auditContext);
    }
}
