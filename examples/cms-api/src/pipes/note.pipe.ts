import { Injectable } from '@nestjs/common';
import { Note } from '../models';
import { BaseEntityByIdPipe } from '@trailmix-cms/utils';
import { NoteCollection } from '../collections';

@Injectable()
export class NoteByIdPipe extends BaseEntityByIdPipe<Note.Entity> {
    constructor(
        protected readonly collection: NoteCollection
    ) {
        super(collection);
    }
}
