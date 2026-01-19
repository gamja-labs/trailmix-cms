import { Injectable } from '@nestjs/common';
import { BaseEntityByIdPipe } from '@trailmix-cms/utils';
import { RoleCollection } from '../collections/role.collection';
import * as models from '@trailmix-cms/models';

@Injectable()
export class RoleByIdPipe extends BaseEntityByIdPipe<models.Role.Entity> {
    constructor(
        protected readonly collection: RoleCollection
    ) {
        super(collection);
    }
}
