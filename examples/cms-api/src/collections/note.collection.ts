import { Collection } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DocumentCollection, DatabaseService, Collections, RevisableCollection } from '@trailmix-cms/db';
import { Note } from '../models';
import { CollectionName } from '../constants';

type Entity = Note.Entity
const collectionName = CollectionName.Note;

@Injectable()
export class NoteCollection extends RevisableCollection<Entity> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = Note.entitySchema;

    constructor(
        @DocumentCollection(collectionName)
        protected readonly collection: Collection<Entity>,
        protected readonly databaseService: DatabaseService,
        // RevisableCollection writes a Revision record (before/after/query)
        // for every mutation, so it needs the RevisionCollection injected.
        protected readonly revisionCollection: Collections.RevisionCollection,
    ) {
        super(collection, databaseService, revisionCollection);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`)
        await this.collection.createIndex({ title: 1 });
    }
}
