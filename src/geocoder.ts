export interface GeocodedPoint {
  lat: number;
  lng: number;
}

/** Resolves a free-form address string to a coordinate. Implementations are pluggable (Nominatim, Google, Mapbox, ...). */
export interface GeocoderResolver {
  resolve(address: string): Promise<GeocodedPoint | null>;
}

/** No-op resolver useful as a default/fallback when no geocoding backend is configured. */
export class NullGeocoder implements GeocoderResolver {
  async resolve(_address: string): Promise<GeocodedPoint | null> {
    return null;
  }
}

/** Resolve an address using the given resolver (defaults to a no-op resolver). */
export async function geocodeAddress(
  address: string,
  resolver: GeocoderResolver = new NullGeocoder(),
): Promise<GeocodedPoint | null> {
  if (!address.trim()) return null;
  return resolver.resolve(address);
}

export interface GeocodedBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** A geocoded result enriched with the display metadata Places Text Search returns alongside a coordinate. */
export interface GeocodedPlace extends GeocodedPoint {
  displayName: string;
  formattedAddress: string;
  boundingBox?: GeocodedBoundingBox;
}

const PLACES_SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_GEOCODER_FIELD_MASK = "places.location,places.displayName,places.formattedAddress,places.viewport";

interface RawTextSearchPlace {
  location?: { latitude?: number; longitude?: number };
  displayName?: { text?: string };
  formattedAddress?: string;
  viewport?: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
  };
}

/**
 * Google Places (New) Text Search resolver — accepts free-form queries (street addresses, ZIP codes,
 * "City, ST") and resolves the first match to a point plus display metadata and viewport bounding box.
 * Dependency-injectable `fetchImpl`/`apiKey`, matching this stack's existing pluggable-fallback pattern
 * (see GooglePlacesAdapter): with no `apiKey` configured, `resolve` returns `null` with no network call,
 * so callers can layer this atop a static/offline resolver without branching on key presence.
 */
export class GooglePlacesGeocoder implements GeocoderResolver {
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly fieldMask: string;

  constructor(
    { apiKey, fetchImpl, fieldMask }: { apiKey?: string; fetchImpl?: typeof fetch; fieldMask?: string } = {},
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl ?? fetch;
    this.fieldMask = fieldMask ?? DEFAULT_GEOCODER_FIELD_MASK;
  }

  async resolve(address: string): Promise<GeocodedPlace | null> {
    const query = address.trim();
    if (!query || !this.apiKey) return null;

    const response = await this.fetchImpl(PLACES_SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": this.fieldMask,
      },
      body: JSON.stringify({ textQuery: query }),
    });

    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    const place: RawTextSearchPlace | undefined = data?.places?.[0];
    const lat = place?.location?.latitude;
    const lng = place?.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    const viewport = place?.viewport;
    const boundingBox =
      typeof viewport?.low?.latitude === "number" &&
      typeof viewport?.low?.longitude === "number" &&
      typeof viewport?.high?.latitude === "number" &&
      typeof viewport?.high?.longitude === "number"
        ? {
            south: viewport.low.latitude,
            west: viewport.low.longitude,
            north: viewport.high.latitude,
            east: viewport.high.longitude,
          }
        : undefined;

    return {
      lat,
      lng,
      displayName: place?.displayName?.text ?? query,
      formattedAddress: place?.formattedAddress ?? place?.displayName?.text ?? query,
      boundingBox,
    };
  }
}
