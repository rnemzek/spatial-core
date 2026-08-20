import type { UnindexedFeature } from "./types.js";
import type { IngestionAdapter } from "./ingestion/types.js";
import type { SpatialCellIndex } from "./spatialCellIndex.js";
export interface PlacesSearchQuery {
    lat: number;
    lng: number;
    radiusMeters: number;
    includedType: string;
}
interface RawPlace {
    id?: string;
    displayName?: {
        text?: string;
    };
    location?: {
        latitude?: number;
        longitude?: number;
    };
}
/**
 * Google Places (New) `searchNearby` adapter — the spatial-hydration "Look Far" gap-fill source.
 * Uses a Field Mask to request only `id, displayName, location`, keeping responses minimal.
 * Dependency-injectable `fetchImpl`/`apiKey`, matching this stack's existing LLM/geocoder pluggable-fallback
 * pattern: with no `apiKey` configured, `fetchRaw` resolves to an empty result set with no network call.
 */
export declare class GooglePlacesAdapter implements IngestionAdapter {
    providerId: string;
    topic: "auto" | "ev" | "retail";
    private readonly apiKey?;
    private readonly fetchImpl;
    private readonly fieldMask;
    constructor({ apiKey, fetchImpl, fieldMask, topic }?: {
        apiKey?: string;
        fetchImpl?: typeof fetch;
        fieldMask?: string;
        topic?: "auto" | "ev" | "retail";
    });
    fetchRaw(query: PlacesSearchQuery): Promise<{
        places: RawPlace[];
    }>;
    normalize(rawData: {
        places: RawPlace[];
    }): Promise<UnindexedFeature[]>;
}
/**
 * Runs a "Look Far" gap-fill discovery: queries `adapter` around `origin`, caches every newly-discovered
 * node into `index` (skipping ids already indexed), and returns just the newly-cached features so a
 * caller can fold them into a LayerConfig before handing off to the active domain overlay.
 */
export declare function discoverNearby(origin: {
    lat: number;
    lng: number;
}, radiusKm: number, { adapter, index, includedType }: {
    adapter: GooglePlacesAdapter;
    index: SpatialCellIndex;
    includedType?: string;
}): Promise<UnindexedFeature[]>;
export {};
