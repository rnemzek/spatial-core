import type { UnindexedFeature } from "./types.js";
import { latLngToCell, DEFAULT_RESOLUTION } from "./h3.js";
import { getNearbyCells } from "./agent.js";

/**
 * H3-indexed cache of geocoded features, keyed by cell then feature id. Used to cache spatial-hydration
 * fallback results (e.g. Places API discoveries) so repeated nearby queries don't re-fetch or re-index
 * nodes already known to the engine.
 */
export class SpatialCellIndex {
  private readonly resolution: number;
  private readonly cells = new Map<string, Map<string, UnindexedFeature>>();
  private readonly featureIds = new Set<string>();

  constructor(resolution: number = DEFAULT_RESOLUTION) {
    this.resolution = resolution;
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
}
