import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { entitySchema as NoteEntitySchema } from '../models/note';
import { InternalFields, Revision } from '@trailmix-cms/models';

// `version` is owned by the VersionedCollection, so it is never part of a create payload.
const NoteWritableFields = { ...InternalFields, version: true } as const;

export const CreateNoteSchema = NoteEntitySchema.omit(NoteWritableFields);
export type CreateNoteSchema = z.input<typeof CreateNoteSchema>;
export class CreateNoteDto extends createZodDto(CreateNoteSchema, { codec: true }) { }

// Updates carry the editable fields plus the `version` the client believes is
// current. The collection rejects the write if it no longer matches (409).
export const UpdateNoteSchema = NoteEntitySchema.omit(NoteWritableFields).partial().extend({
    version: z.number().int().nonnegative(),
});
export type UpdateNoteSchema = z.input<typeof UpdateNoteSchema>;
export class UpdateNoteDto extends createZodDto(UpdateNoteSchema, { codec: true }) { }

export const NoteResponseSchema = NoteEntitySchema;
export type NoteResponseSchema = z.input<typeof NoteResponseSchema>;
export class NoteResponseDto extends createZodDto(NoteResponseSchema, { codec: true }) { }

export const NoteListResponseSchema = z.object({
    items: z.array(NoteEntitySchema),
    count: z.number(),
});
export type NoteListResponseSchema = z.input<typeof NoteListResponseSchema>;
export class NoteListResponseDto extends createZodDto(NoteListResponseSchema, { codec: true }) { }

// Delete is version-checked too; the expected version arrives as a query param.
export const DeleteNoteQuerySchema = z.object({
    version: z.coerce.number().int().nonnegative(),
});
export type DeleteNoteQuerySchema = z.input<typeof DeleteNoteQuerySchema>;
export class DeleteNoteQueryDto extends createZodDto(DeleteNoteQuerySchema, { codec: true }) { }

// Revision history — each mutation records the before/after document and the query.
export const RevisionResponseSchema = Revision.schema;
export type RevisionResponseSchema = z.input<typeof RevisionResponseSchema>;
export class RevisionResponseDto extends createZodDto(RevisionResponseSchema, { codec: true }) { }

export const RevisionListResponseSchema = z.object({
    items: z.array(Revision.schema),
    count: z.number(),
});
export type RevisionListResponseSchema = z.input<typeof RevisionListResponseSchema>;
export class RevisionListResponseDto extends createZodDto(RevisionListResponseSchema, { codec: true }) { }
