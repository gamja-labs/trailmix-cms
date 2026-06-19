import { Injectable } from '@nestjs/common';
import { BaseEntityByIdPipe } from '@trailmix-cms/utils';
import * as models from '@trailmix-cms/models';
import { OrganizationCollection } from '../collections/organization.collection.js';

@Injectable()
export class OrganizationByIdPipe extends BaseEntityByIdPipe<models.Organization.Entity> {
    constructor(
        protected readonly collection: OrganizationCollection
    ) {
        super(collection);
    }
}
