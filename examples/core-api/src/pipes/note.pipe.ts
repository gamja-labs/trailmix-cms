import { Injectable } from '@nestjs/common';
import { BaseEntityByIdPipe } from '@trailmix-cms/utils';

import { Note } from '../models';
import { NoteCollection } from '../collections';

/** Resolves a `:noteId` route param to the Note entity (404 if not found). */
@Injectable()
export class NoteByIdPipe extends BaseEntityByIdPipe<Note.Entity> {
    constructor(protected readonly collection: NoteCollection) {
        super(collection);
    }
}
