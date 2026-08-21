export interface GeocodingBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeocodedPoint {
  lat: number;
  lng: number;
  /** Short human-readable place name (e.g. "Pensacola, Florida"), when the backend provides one. */
  displayName?: string;
  /** Full formatted address/place string, when the backend provides one. */
  formattedAddress?: string;
  /** Viewport the backend considers a reasonable map extent for the resolved place, when available. */
  boundingBox?: GeocodingBoundingBox;
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

const PLACES_SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODER_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.viewport";

interface RawGeocodedPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  viewport?: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
  };
}

/**
 * Google Places (New) `searchText` adapter — resolves a free-form query ("Pensacola, FL", "32501",
 * a street address, ...) to a coordinate plus display metadata. Dependency-injectable `fetchImpl`/
 * `apiKey`, matching this stack's existing pluggable-fallback pattern: with no `apiKey` configured,
 * `resolve` returns `null` with no network call.
 */
export class GooglePlacesGeocoder implements GeocoderResolver {
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ apiKey, fetchImpl }: { apiKey?: string; fetchImpl?: typeof fetch } = {}) {
    this.apiKey = apiKey;
    // Bind to globalThis regardless of source: native fetch throws "Illegal invocation" when
    // called as `this.fetchImpl(...)` (an unbound method call) rather than `window.fetch(...)`.
    this.fetchImpl = (fetchImpl ?? fetch).bind(globalThis);
  }

  async resolve(address: string): Promise<GeocodedPoint | null> {
    if (!this.apiKey || !address.trim()) return null;

    const response = await this.fetchImpl(PLACES_SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": GEOCODER_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: address }),
    });

    if (!response.ok) return null;

    const data = await response.json().catch(() => null);
    const place: RawGeocodedPlace | undefined = data?.places?.[0];
    const lat = place?.location?.latitude;
    const lng = place?.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    const low = place?.viewport?.low;
    const high = place?.viewport?.high;
    const boundingBox =
      typeof low?.latitude === "number" &&
      typeof low?.longitude === "number" &&
      typeof high?.latitude === "number" &&
      typeof high?.longitude === "number"
        ? { south: low.latitude, west: low.longitude, north: high.latitude, east: high.longitude }
        : undefined;

    return {
      lat,
      lng,
      displayName: place?.displayName?.text,
      formattedAddress: place?.formattedAddress,
      boundingBox,
    };
  }
}
