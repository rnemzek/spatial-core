import type { UnindexedFeature } from "./types.js";
export interface SpatialCellIndexOptions {
    /** H3 resolution features and cell-hydration timestamps are indexed at. Defaults to DEFAULT_RESOLUTION (8). */
    resolution?: number;
    /** How long a cell's hydration stays fresh, in ms. Omit for cells that never expire once hydrated. */
    ttlMs?: number;
}
/**
 * H3-indexed cache of geocoded features, keyed by cell then feature id. Used to cache spatial-hydration
 * fallback results (e.g. Places API discoveries) so repeated nearby queries don't re-fetch or re-index
 * nodes already known to the engine.
 *
 * Also tracks per-cell hydration timestamps, independent of feature presence: a cell can be legitimately
 * hydrated with zero results, so "is this cell fresh" (skip re-fetching) is a distinct question from
 * "does this cell have any features." See markCellHydrated/isCellFresh.
 */
export declare class SpatialCellIndex {
    private readonly resolution;
    private readonly ttlMs?;
    private readonly cells;
    private readonly featureIds;
    private readonly hydratedAt;
    constructor({ resolution, ttlMs }?: SpatialCellIndexOptions);
    /** Indexes a feature into its H3 cell. No-ops for features without coordinates. */
    upsert(feature: UnindexedFeature): void;
    /** Whether a feature with this id is already indexed. */
    has(id: string): boolean;
    /** All indexed features whose cell falls within `radiusKm` of `lat`/`lng`. */
    queryNearby(lat: number, lng: number, radiusKm: number): UnindexedFeature[];
    /** Records the H3 cell containing `lat`/`lng` as hydrated at `at` (defaults to now). */
    markCellHydrated(lat: number, lng: number, at?: number): void;
    /**
     * Whether the H3 cell containing `lat`/`lng` was hydrated within `ttlMs`. Always false for a cell
     * that's never been marked hydrated. Always true (once hydrated) when no `ttlMs` was configured.
     */
    isCellFresh(lat: number, lng: number, now?: number): boolean;
}
