import type { UnindexedFeature } from "./types.js";
import type { IngestionAdapter } from "./ingestion/types.js";
import type { SpatialCellIndex } from "./spatialCellIndex.js";

const PLACES_SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const DEFAULT_FIELD_MASK = "places.id,places.displayName,places.location";

export interface PlacesSearchQuery {
  lat: number;
  lng: number;
  radiusMeters: number;
  includedType: string;
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
}

/**
 * Google Places (New) `searchNearby` adapter — the spatial-hydration "Look Far" gap-fill source.
 * Uses a Field Mask to request only `id, displayName, location`, keeping responses minimal.
 * Dependency-injectable `fetchImpl`/`apiKey`, matching this stack's existing LLM/geocoder pluggable-fallback
 * pattern: with no `apiKey` configured, `fetchRaw` resolves to an empty result set with no network call.
 */
export class GooglePlacesAdapter implements IngestionAdapter {
  providerId = "google-places";
  topic: "auto" | "ev" | "retail";

  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly fieldMask: string;

  constructor(
    { apiKey, fetchImpl, fieldMask, topic }: { apiKey?: string; fetchImpl?: typeof fetch; fieldMask?: string; topic?: "auto" | "ev" | "retail" } = {},
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl ?? fetch;
    this.fieldMask = fieldMask ?? DEFAULT_FIELD_MASK;
    this.topic = topic ?? "auto";
  }

  async fetchRaw(query: PlacesSearchQuery): Promise<{ places: RawPlace[] }> {
    if (!this.apiKey) return { places: [] };

    const response = await this.fetchImpl(PLACES_SEARCH_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": this.fieldMask,
      },
      body: JSON.stringify({
        includedTypes: [query.includedType],
        locationRestriction: {
          circle: {
            center: { latitude: query.lat, longitude: query.lng },
            radius: query.radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) return { places: [] };

    const data = await response.json().catch(() => null);
    if (!data || !Array.isArray(data.places)) return { places: [] };
    return { places: data.places };
  }

  async normalize(rawData: { places: RawPlace[] }): Promise<UnindexedFeature[]> {
    const features: UnindexedFeature[] = [];
    for (const place of rawData.places ?? []) {
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (!place.id || typeof lat !== "number" || typeof lng !== "number") continue;
      features.push({
        id: place.id,
        title: place.displayName?.text ?? "Unnamed location",
        topic: this.topic,
        coordinates: { lat, lng },
        metadata: { googlePlaceId: place.id, primaryType: place.primaryType ?? null },
      });
    }
    return features;
  }
}

/**
 * Runs a "Look Far" gap-fill discovery: queries `adapter` around `origin`, caches every newly-discovered
 * node into `index` (skipping ids already indexed), and returns just the newly-cached features so a
 * caller can fold them into a LayerConfig before handing off to the active domain overlay.
 */
export async function discoverNearby(
  origin: { lat: number; lng: number },
  radiusKm: number,
  { adapter, index, includedType = "car_dealer" }: { adapter: GooglePlacesAdapter; index: SpatialCellIndex; includedType?: string },
): Promise<UnindexedFeature[]> {
  const rawData = await adapter.fetchRaw({
    lat: origin.lat,
    lng: origin.lng,
    radiusMeters: radiusKm * 1000,
    includedType,
  });
  const features = await adapter.normalize(rawData);

  const newFeatures: UnindexedFeature[] = [];
  for (const feature of features) {
    if (index.has(feature.id)) continue;
    index.upsert(feature);
    newFeatures.push(feature);
  }
  return newFeatures;
}
