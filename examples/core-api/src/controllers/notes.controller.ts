import { Body, ConflictException, Controller, Delete, Get, Logger, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { RevisionConflictError, Collections } from '@trailmix-cms/db';
import { AuditContext as AuditContextModel } from '@trailmix-cms/models';
// `AuditContext` (the param decorator) is provider-agnostic — from the core entry. `Session` /
// `UserSession` are better-auth session helpers — from the better-auth subpath.
import { AuditContext } from '@trailmix-cms/core';
import { Session, type UserSession } from '@trailmix-cms/core/better-auth';

import { Note } from '../models';
import { NoteCollection } from '../collections';
import { NoteByIdPipe } from '../pipes';
import { CollectionName } from '../constants';
import {
    CreateNoteDto,
    UpdateNoteDto,
    NoteResponseDto,
    NoteListResponseDto,
    DeleteNoteQueryDto,
    RevisionListResponseDto,
} from '../dto/note.dto';

/**
 * CRUD over a **revisable** collection. No guard decorator is needed — the global better-auth
 * `AuthGuard` already protects every route, so a valid session is required. Each mutation is
 * version-checked (optimistic concurrency) and records a `Revision` (before/after/query).
 */
@ApiTags('notes')
@ApiBearerAuth()
@Controller('notes')
export class NotesController {
    private readonly logger = new Logger(NotesController.name);

    constructor(
        private readonly notes: NoteCollection,
        private readonly revisions: Collections.RevisionCollection,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a note (starts at version 0)' })
    @ZodResponse({ status: 201, description: 'Note created.', type: NoteResponseDto })
    create(@Body() body: CreateNoteDto, @AuditContext() auditContext: AuditContextModel.Model) {
        this.logger.log(`Creating note: ${body.title}`);
        return this.notes.insertOne(body, auditContext);
    }

    @Get()
    @ApiOperation({ summary: 'List notes' })
    @ZodResponse({ status: 200, description: 'All notes.', type: NoteListResponseDto })
    async list() {
        const items = await this.notes.find({});
        return { items, count: items.length };
    }

    @Get(':noteId')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'Get a note by ID' })
    @ZodResponse({ status: 200, description: 'The note.', type: NoteResponseDto })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    get(@Param('noteId', NoteByIdPipe) note: Note.Entity) {
        return note;
    }

    @Get(':noteId/revisions')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'List a note’s revision history (newest first)' })
    @ZodResponse({ status: 200, description: 'Revision records.', type: RevisionListResponseDto })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    async revisionHistory(@Param('noteId', NoteByIdPipe) note: Note.Entity) {
        const items = await this.revisions.find(
            { entity_id: note._id, entity_type: CollectionName.Note },
            { sort: { created_at: -1 } },
        );
        return { items, count: items.length };
    }

    @Put(':noteId')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'Update a note (optimistic concurrency on version)' })
    @ZodResponse({ status: 200, description: 'Note updated.', type: NoteResponseDto })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    @ApiConflictResponse({ description: 'Stale version; reload and retry.' })
    async update(
        @Param('noteId', NoteByIdPipe) note: Note.Entity,
        @Body() body: UpdateNoteDto,
        @AuditContext() auditContext: AuditContextModel.Model,
    ) {
        const { version, ...changes } = body;
        try {
            return await this.notes.findOneAndUpdate({ _id: note._id }, { $set: changes }, version, auditContext);
        } catch (error) {
            if (error instanceof RevisionConflictError) throw new ConflictException(error.message);
            throw error;
        }
    }

    @Delete(':noteId')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'Delete a note (optimistic concurrency on version)' })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    @ApiConflictResponse({ description: 'Stale version; reload and retry.' })
    async remove(
        @Param('noteId', NoteByIdPipe) note: Note.Entity,
        @Query() query: DeleteNoteQueryDto,
        @AuditContext() auditContext: AuditContextModel.Model,
    ): Promise<void> {
        try {
            await this.notes.deleteOne(note._id, query.version, auditContext);
        } catch (error) {
            if (error instanceof RevisionConflictError) throw new ConflictException(error.message);
            throw error;
        }
    }
}
