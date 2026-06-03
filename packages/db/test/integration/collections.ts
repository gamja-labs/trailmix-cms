import { Collection } from 'mongodb';
import { Injectable } from '@nestjs/common';
import {
    BaseCollection,
    AuditedCollection,
    VersionedCollection,
    DatabaseService,
    DocumentCollection,
    Collections,
} from '../../src';
import { Widget, widgetSchema, Gadget, gadgetSchema, TestCollectionName } from './entities';

/**
 * Concrete {@link BaseCollection} used to test the un-audited base CRUD path.
 */
@Injectable()
export class WidgetCollection extends BaseCollection<Widget> {
    public readonly collectionName = TestCollectionName.Widget;
    public readonly entitySchema = widgetSchema;

    constructor(
        @DocumentCollection(TestCollectionName.Widget)
        protected readonly collection: Collection<Widget>,
        protected readonly databaseService: DatabaseService,
    ) {
        super(collection, databaseService);
    }
}

/**
 * Concrete {@link AuditedCollection} used to test that writes also emit audit
 * records into the internal `audit` collection.
 */
@Injectable()
export class AuditedWidgetCollection extends AuditedCollection<Widget> {
    public readonly collectionName = TestCollectionName.AuditedWidget;
    public readonly entitySchema = widgetSchema;

    constructor(
        @DocumentCollection(TestCollectionName.AuditedWidget)
        protected readonly collection: Collection<Widget>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection,
    ) {
        super(collection, databaseService, auditCollection);
    }
}

/**
 * Concrete {@link VersionedCollection} used to test optimistic locking and the
 * `revision` trail.
 */
@Injectable()
export class GadgetCollection extends VersionedCollection<Gadget> {
    public readonly collectionName = TestCollectionName.Gadget;
    public readonly entitySchema = gadgetSchema;

    constructor(
        @DocumentCollection(TestCollectionName.Gadget)
        protected readonly collection: Collection<Gadget>,
        protected readonly databaseService: DatabaseService,
        protected readonly revisionCollection: Collections.RevisionCollection,
    ) {
        super(collection, databaseService, revisionCollection);
    }
}

/** All test collection service classes, for registration with the test module. */
export const testCollectionServices = [
    WidgetCollection,
    AuditedWidgetCollection,
    GadgetCollection,
];
