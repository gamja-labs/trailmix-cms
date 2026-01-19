import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ObjectId, Filter } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { RoleCollection } from '../collections/role.collection';
import { Utils } from '@trailmix-cms/db';

type GlobalRoleModel = models.GlobalRole.Model;
type RoleEntity = models.Role.Entity;

@Injectable()
export class GlobalRoleService {
    private readonly logger = new Logger(GlobalRoleService.name);

    constructor(
        private readonly roleCollection: RoleCollection,
    ) { }

    async insertOne(
        params: Utils.Creatable<GlobalRoleModel>,
        auditContext: models.AuditContext.Model,
    ): Promise<GlobalRoleModel> {
        const insertParams: Utils.Creatable<RoleEntity> = {
            ...params,
            type: models.RoleType.Global,
        };

        const entity = await this.roleCollection.insertOne(insertParams, auditContext);
        return this.mapToModel(entity);
    }

    async find(filter?: Filter<GlobalRoleModel>): Promise<GlobalRoleModel[]> {
        const query: Filter<RoleEntity> = {
            ...filter,
            type: models.RoleType.Global,
        };
        const entities = await this.roleCollection.find(query);
        return entities.map(entity => this.mapToModel(entity));
    }

    async findOne(params: Filter<GlobalRoleModel>): Promise<GlobalRoleModel | null> {
        const query: Filter<RoleEntity> = {
            ...params,
            type: models.RoleType.Global,
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

    private mapToModel(entity: RoleEntity): GlobalRoleModel {
        if (entity.type !== models.RoleType.Global) {
            throw new Error('Entity is not a global role');
        }

        // TODO: Add mapping logic here
        return entity as GlobalRoleModel;
    }
}
