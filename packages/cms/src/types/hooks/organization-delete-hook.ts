import { ObjectId, ClientSession } from 'mongodb';
import { Organization, AuditContext } from '@trailmix-cms/models';

/**
 * Interface for organization delete hooks that execute custom logic when an organization is deleted.
 * The hook receives the transaction session so it can perform additional deletions within the same transaction.
 */
export interface OrganizationDeleteHook {
    /**
     * Called when an organization is being deleted, within the delete transaction.
     * Use the provided session to perform additional deletions that should be part of the same atomic operation.
     * 
     * @param organizationId The ID of the organization being deleted
     * @param organization The organization entity being deleted
     * @param auditContext The audit context for tracking the deletion
     * @param session The MongoDB client session for the delete transaction
     * @returns Promise<void>
     */
    onHook(
        organizationId: ObjectId,
        organization: Organization.Entity,
        auditContext: AuditContext.Model,
        session: ClientSession
    ): Promise<void>;
}
