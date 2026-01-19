import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Filter, ObjectId } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { RoleCollection } from '../collections/role.collection';
import { Utils } from '@trailmix-cms/db';

type OrganizationRoleModel = models.OrganizationRole.Model;
type RoleEntity = models.Role.Entity;

@Injectable()
export class OrganizationRoleService {
    private readonly logger = new Logger(OrganizationRoleService.name);

    constructor(
        private readonly roleCollection: RoleCollection,
    ) { }

    async insertOne(
        params: Utils.Creatable<OrganizationRoleModel>,
        auditContext: models.AuditContext.Model,
    ): Promise<OrganizationRoleModel> {
        const insertParams: Utils.Creatable<RoleEntity> = {
            ...params,
            type: models.RoleType.Organization,
        };

        const entity = await this.roleCollection.insertOne(insertParams, auditContext);
        return this.mapToModel(entity);
    }

    async find(filter: Filter<OrganizationRoleModel>) {
        const query: Filter<RoleEntity> = {
            ...filter as Filter<RoleEntity>,
            type: models.RoleType.Organization,
        };
        const entities = await this.roleCollection.find(query);
        return entities.map(entity => this.mapToModel(entity));
    }

    async findOne(params: Filter<OrganizationRoleModel>) {
        const query: Filter<RoleEntity> = {
            ...params as Filter<RoleEntity>,
            type: models.RoleType.Organization,
        };
        const entity = await this.roleCollection.findOne(query);
        if (!entity) {
            return null;
        }
        return this.mapToModel(entity);
    }

    async deleteOne(
        id: ObjectId,
        auditContext: models.AuditContext.Model,
    ): Promise<void> {
        await this.roleCollection.deleteOne(id, auditContext);
    }

    private mapToModel(entity: RoleEntity): OrganizationRoleModel {
        if (entity.type !== models.RoleType.Organization) {
            throw new Error('Entity is not an organization role');
        }
        if (!entity.organization_id) {
            throw new Error('Organization role must have organization_id');
        }

        // TODO: Add mapping logic here
        return entity as OrganizationRoleModel;
    }

}
