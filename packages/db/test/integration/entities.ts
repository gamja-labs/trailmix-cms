import { z } from 'zod';
import { baseEntitySchema, versionedSchema } from '@trailmix-cms/models';

/**
 * Plain entity used to exercise {@link BaseCollection} and
 * {@link AuditedCollection}. It only adds a couple of arbitrary fields on top
 * of the shared base entity so we can assert reads/writes behave correctly.
 */
export const widgetSchema = baseEntitySchema.extend({
    name: z.string(),
    quantity: z.number().int(),
}).meta({
    id: 'Widget',
});

export type Widget = z.infer<typeof widgetSchema>;

/**
 * Versioned entity used to exercise {@link RevisableCollection}. It carries the
 * `version` field via {@link versionedSchema} so optimistic-locking behaviour
 * can be tested.
 */
export const gadgetSchema = baseEntitySchema.extend({
    ...versionedSchema.shape,
    label: z.string(),
}).meta({
    id: 'Gadget',
});

export type Gadget = z.infer<typeof gadgetSchema>;

/**
 * Collection names backing the test entities. Kept separate from the library's
 * internal collection names so the integration suite owns its own namespace.
 */
export const TestCollectionName = {
    /** Backed by a plain {@link BaseCollection}. */
    Widget: 'widget',
    /** Backed by an {@link AuditedCollection}. */
    AuditedWidget: 'audited_widget',
    /** Backed by a {@link RevisableCollection}. */
    Gadget: 'gadget',
} as const;

export type TestCollectionName = typeof TestCollectionName[keyof typeof TestCollectionName];
