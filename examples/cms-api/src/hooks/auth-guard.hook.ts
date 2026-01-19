import { Injectable, Logger } from '@nestjs/common';
import { AuthGuardHook, Collections as CMSCollections } from '@trailmix-cms/cms';
import * as trailmixModels from '@trailmix-cms/models';
import { TodoListCollection } from '../collections/todo-list.collection';

@Injectable()
export class AppAuthGuardHook implements AuthGuardHook {
    private readonly logger = new Logger(AppAuthGuardHook.name);
    constructor(
        private readonly todoListCollection: TodoListCollection,
        private readonly organizationCollection: CMSCollections.OrganizationCollection,
        private readonly roleCollection: CMSCollections.RoleCollection,
    ) {}

    async onHook(account: trailmixModels.Account.Entity): Promise<boolean> {
        this.logger.log(`Creating organization and role for account: ${account._id}`);
        // Create an organization for the user
        const organization = await this.organizationCollection.insertOne({
            name: `Default Organization`,
            description: 'Default organization created for user',
        } as any, {
            system: false,
            anonymous: false,
            principal_id: account._id,
            principal_type: trailmixModels.Principal.Account,
        });

        // Assign the user as Owner of the organization
        await this.roleCollection.insertOne({
            type: trailmixModels.RoleType.Organization,
            principal_id: account._id,
            principal_type: trailmixModels.Principal.Account,
            organization_id: organization._id,
            role: trailmixModels.RoleValue.Owner,
        }, {
            system: false,
            anonymous: false,
            principal_id: account._id,
            principal_type: trailmixModels.Principal.Account,
        });

        // Create a todo list in the organization
        await this.todoListCollection.insertOne({
            name: 'My first todo list',
            organization_id: organization._id,
        }, {
            system: false,
            anonymous: false,
            principal_id: account._id,
            principal_type: trailmixModels.Principal.Account,
        });

        return true;
    }
}

