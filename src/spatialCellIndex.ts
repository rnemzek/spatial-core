import type { UnindexedFeature } from "./types.js";
import { latLngToCell, DEFAULT_RESOLUTION } from "./h3.js";
import { getNearbyCells } from "./agent.js";

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
export class SpatialCellIndex {
  private readonly resolution: number;
  private readonly ttlMs?: number;
  private readonly cells = new Map<string, Map<string, UnindexedFeature>>();
  private readonly featureIds = new Set<string>();
  private readonly hydratedAt = new Map<string, number>();

  constructor({ resolution = DEFAULT_RESOLUTION, ttlMs }: SpatialCellIndexOptions = {}) {
    this.resolution = resolution;
    this.ttlMs = ttlMs;
  }

  /** Indexes a feature into its H3 cell. No-ops for features without coordinates. */
  upsert(feature: UnindexedFeature): void {
    if (!feature.coordinates) return;
    const cell = latLngToCell(feature.coordinates.lat, feature.coordinates.lng, this.resolution);
    if (!this.cells.has(cell)) this.cells.set(cell, new Map());
    this.cells.get(cell)!.set(feature.id, feature);
    this.featureIds.add(feature.id);
  }

  /** Whether a feature with this id is already indexed. */
  has(id: string): boolean {
    return this.featureIds.has(id);
  }

  /** All indexed features whose cell falls within `radiusKm` of `lat`/`lng`. */
  queryNearby(lat: number, lng: number, radiusKm: number): UnindexedFeature[] {
    const nearbyCells = getNearbyCells(lat, lng, radiusKm);
    const results: UnindexedFeature[] = [];
    for (const cell of nearbyCells) {
      const bucket = this.cells.get(cell);
      if (!bucket) continue;
      results.push(...bucket.values());
    }
    return results;
  }

  /** Records the H3 cell containing `lat`/`lng` as hydrated at `at` (defaults to now). */
  markCellHydrated(lat: number, lng: number, at: number = Date.now()): void {
    const cell = latLngToCell(lat, lng, this.resolution);
    this.hydratedAt.set(cell, at);
  }

  /**
   * Whether the H3 cell containing `lat`/`lng` was hydrated within `ttlMs`. Always false for a cell
   * that's never been marked hydrated. Always true (once hydrated) when no `ttlMs` was configured.
   */
  isCellFresh(lat: number, lng: number, now: number = Date.now()): boolean {
    const cell = latLngToCell(lat, lng, this.resolution);
    const hydratedAt = this.hydratedAt.get(cell);
    if (hydratedAt === undefined) return false;
    if (this.ttlMs === undefined) return true;
    return now - hydratedAt < this.ttlMs;
  }
}
