import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { InternalFields, Revision } from '@trailmix-cms/models';

import { entitySchema as NoteEntitySchema } from '../models/note';

// `version` is owned by the RevisableCollection, so it is never part of a write payload.
const NoteWritableFields = { ...InternalFields, version: true } as const;

export class CreateNoteDto extends createZodDto(NoteEntitySchema.omit(NoteWritableFields), { codec: true }) {}

// Updates carry the editable fields plus the `version` the client believes is current; the
// collection rejects the write with 409 if it no longer matches (optimistic concurrency).
export class UpdateNoteDto extends createZodDto(
    NoteEntitySchema.omit(NoteWritableFields).partial().extend({
        version: z.number().int().nonnegative(),
    }),
    { codec: true },
) {}

// Delete is version-checked too; the expected version arrives as a query param.
export class DeleteNoteQueryDto extends createZodDto(
    z.object({ version: z.coerce.number().int().nonnegative() }),
    { codec: true },
) {}

export class NoteResponseDto extends createZodDto(NoteEntitySchema, { codec: true }) {}

export class NoteListResponseDto extends createZodDto(
    z.object({ items: z.array(NoteEntitySchema), count: z.number() }),
    { codec: true },
) {}

// Revision history — each mutation records the before/after document and the query.
export class RevisionListResponseDto extends createZodDto(
    z.object({ items: z.array(Revision.schema), count: z.number() }),
    { codec: true },
) {}
