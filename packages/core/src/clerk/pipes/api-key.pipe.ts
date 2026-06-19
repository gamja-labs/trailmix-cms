import { Injectable } from '@nestjs/common';
import { BaseEntityByIdPipe } from '@trailmix-cms/utils';
import * as models from '@trailmix-cms/models';
import { ApiKeyCollection } from '../collections/api-key.collection.js';

@Injectable()
export class ApiKeyByIdPipe extends BaseEntityByIdPipe<models.ApiKey.Entity> {
    constructor(
        protected readonly collection: ApiKeyCollection
    ) {
        super(collection);
    }
}
