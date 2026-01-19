import { Injectable } from '@nestjs/common';
import { BaseEntityByIdPipe } from '@trailmix-cms/utils';
import { ApiKeyCollection } from '../collections/api-key.collection';
import * as models from '@trailmix-cms/models';

@Injectable()
export class ApiKeyByIdPipe extends BaseEntityByIdPipe<models.ApiKey.Entity> {
    constructor(
        protected readonly collection: ApiKeyCollection
    ) {
        super(collection);
    }
}