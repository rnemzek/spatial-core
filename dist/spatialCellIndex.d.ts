import type { UnindexedFeature } from "./types.js";
/**
 * H3-indexed cache of geocoded features, keyed by cell then feature id. Used to cache spatial-hydration
 * fallback results (e.g. Places API discoveries) so repeated nearby queries don't re-fetch or re-index
 * nodes already known to the engine.
 */
export declare class SpatialCellIndex {
    private readonly resolution;
    private readonly cells;
    private readonly featureIds;
    constructor(resolution?: number);
    /** Indexes a feature into its H3 cell. No-ops for features without coordinates. */
    upsert(feature: UnindexedFeature): void;
    /** Whether a feature with this id is already indexed. */
    has(id: string): boolean;
    /** All indexed features whose cell falls within `radiusKm` of `lat`/`lng`. */
    queryNearby(lat: number, lng: number, radiusKm: number): UnindexedFeature[];
}
