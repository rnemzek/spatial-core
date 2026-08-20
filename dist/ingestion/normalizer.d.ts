import { z } from "zod";
import type { UnindexedFeature } from "../types.js";
/** Validates a single UnindexedFeature record. Requires an id, title, and either a geocodable address or coordinates. */
export declare const UnindexedFeatureSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    topic: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    coordinates: z.ZodOptional<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strip>>;
    synopsisCardHtml: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
/**
 * Normalizes a raw payload (a single record or an array of records) into valid UnindexedFeatures,
 * silently dropping any record that is malformed, corrupted, or missing a required field.
 */
export declare function normalizePayload(payload: unknown): UnindexedFeature[];
