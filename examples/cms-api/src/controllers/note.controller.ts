import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger, ConflictException } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiNotFoundResponse, ApiConflictResponse, ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import {
    CreateNoteDto,
    UpdateNoteDto,
    NoteResponseDto,
    NoteListResponseDto,
    DeleteNoteQueryDto,
    RevisionListResponseDto,
} from '../dto/note.dto';
import { NoteByIdPipe } from '../pipes';
import { Note } from '../models';
import { NoteCollection } from '../collections';
import { CollectionName } from '../constants';
import { VersionConflictError, Collections } from '@trailmix-cms/db';
import { AuditContext } from '@trailmix-cms/models';
import { Auth, AuditContext as AuditContextDecorator } from '@trailmix-cms/cms';

@Auth()
@ApiTags('notes')
@Controller('notes')
export class NoteController {
    private readonly logger = new Logger(NoteController.name);

    constructor(
        private readonly noteCollection: NoteCollection,
        private readonly revisionCollection: Collections.RevisionCollection,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new note (starts at version 0)' })
    @ZodResponse({ status: 201, description: 'Note created successfully.', type: NoteResponseDto })
    async createNote(
        @Body() createDto: CreateNoteDto,
        @AuditContextDecorator() auditContext: AuditContext.Model,
    ) {
        this.logger.log(`Creating note: ${createDto.title}`);
        // The collection seeds `version: 0` and records a `create` Revision entry.
        return this.noteCollection.insertOne(createDto, auditContext);
    }

    @Get()
    @ApiOperation({ summary: 'List all notes' })
    @ZodResponse({ status: 200, description: 'List of all notes.', type: NoteListResponseDto })
    async getNotes() {
        const result = await this.noteCollection.find({});
        return {
            items: result,
            count: result.length,
        };
    }

    @Get(':noteId')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'Get a note by ID' })
    @ZodResponse({ status: 200, description: 'Note found.', type: NoteResponseDto })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    async getNoteById(
        @Param('noteId', NoteByIdPipe) note: Note.Entity,
    ) {
        return note;
    }

    @Get(':noteId/revisions')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'List the revision history for a note' })
    @ZodResponse({ status: 200, description: 'Revision records (before/after/query) for the note, newest first.', type: RevisionListResponseDto })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    async getNoteRevisions(
        @Param('noteId', NoteByIdPipe) note: Note.Entity,
    ) {
        // Every create/update/delete on a versioned record writes one of these.
        const items = await this.revisionCollection.find(
            { entity_id: note._id, entity_type: CollectionName.Note },
            { sort: { created_at: -1 } },
        );
        return {
            items,
            count: items.length,
        };
    }

    @Put(':noteId')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'Update a note using optimistic concurrency' })
    @ZodResponse({ status: 200, description: 'Note updated successfully.', type: NoteResponseDto })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    @ApiConflictResponse({ description: 'The supplied version is stale; reload and retry.' })
    async updateNote(
        @Param('noteId', NoteByIdPipe) note: Note.Entity,
        @Body() updateDto: UpdateNoteDto,
        @AuditContextDecorator() auditContext: AuditContext.Model,
    ) {
        const { version, ...changes } = updateDto;
        this.logger.log(`Updating note ${note._id} (expected version ${version})`);
        try {
            // `version` must match the stored value; on success the collection
            // auto-increments it and records before/after/query in the audit.
            return await this.noteCollection.findOneAndUpdate(
                { _id: note._id },
                { $set: changes },
                version,
                auditContext,
            );
        } catch (error) {
            if (error instanceof VersionConflictError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }

    @Delete(':noteId')
    @ApiParam({ name: 'noteId', description: 'Note ID' })
    @ApiOperation({ summary: 'Delete a note using optimistic concurrency' })
    @ApiOkResponse({ description: 'Note deleted successfully.' })
    @ApiNotFoundResponse({ description: 'Note not found.' })
    @ApiConflictResponse({ description: 'The supplied version is stale; reload and retry.' })
    async deleteNote(
        @Param('noteId', NoteByIdPipe) note: Note.Entity,
        @Query() query: DeleteNoteQueryDto,
        @AuditContextDecorator() auditContext: AuditContext.Model,
    ): Promise<void> {
        this.logger.log(`Deleting note ${note._id} (expected version ${query.version})`);
        try {
            await this.noteCollection.deleteOne(note._id, query.version, auditContext);
        } catch (error) {
            if (error instanceof VersionConflictError) {
                throw new ConflictException(error.message);
            }
            throw error;
        }
    }
}
