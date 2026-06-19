import { Injectable } from '@nestjs/common';
import { Filter, ObjectId } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { SecurityAuditCollection } from '../collections/index.js';

export interface RecordSecurityAuditInput {
    event_type: models.SecurityAuditEventType;
    principal_id: ObjectId;
    principal_type: models.Principal;
    message?: string;
    source?: string;
}

/**
 * Convenience service for recording and querying security audit events.
 *
 * Thin wrapper over {@link SecurityAuditCollection} so consumers do not have to
 * interact with the collection (and its `Creatable<>` typings) directly.
 */
@Injectable()
export class SecurityAuditService {
    constructor(private readonly securityAuditCollection: SecurityAuditCollection) { }

    /** Record a security audit event (e.g. an unauthorized access attempt). */
    record(event: RecordSecurityAuditInput) {
        return this.securityAuditCollection.insertOne(event);
    }

    /** List security audit events, newest first. */
    find(filter: Filter<models.SecurityAudit.Entity> = {}) {
        return this.securityAuditCollection.find(filter, { sort: { created_at: -1 } });
    }

    /** Fetch a single security audit event by id. */
    get(id: ObjectId) {
        return this.securityAuditCollection.get(id);
    }
}
