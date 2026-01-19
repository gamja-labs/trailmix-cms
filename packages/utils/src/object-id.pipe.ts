import { PipeTransform, Injectable, ArgumentMetadata, NotFoundException } from '@nestjs/common';
import { validateObjectId } from './validation.js';
import { ObjectId } from 'bson';


@Injectable()
export class ObjectIdPipe implements PipeTransform<string, ObjectId> {
    transform(value: string, metadata: ArgumentMetadata): ObjectId {
        return validateObjectId(value, metadata);
    }
}