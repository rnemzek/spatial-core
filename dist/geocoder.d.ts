export interface GeocodedPoint {
    lat: number;
    lng: number;
}
/** Resolves a free-form address string to a coordinate. Implementations are pluggable (Nominatim, Google, Mapbox, ...). */
export interface GeocoderResolver {
    resolve(address: string): Promise<GeocodedPoint | null>;
}
/** No-op resolver useful as a default/fallback when no geocoding backend is configured. */
export declare class NullGeocoder implements GeocoderResolver {
    resolve(_address: string): Promise<GeocodedPoint | null>;
}
/** Resolve an address using the given resolver (defaults to a no-op resolver). */
export declare function geocodeAddress(address: string, resolver?: GeocoderResolver): Promise<GeocodedPoint | null>;
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
/**
 * Google Places (New) Text Search resolver — accepts free-form queries (street addresses, ZIP codes,
 * "City, ST") and resolves the first match to a point plus display metadata and viewport bounding box.
 * Dependency-injectable `fetchImpl`/`apiKey`, matching this stack's existing pluggable-fallback pattern
 * (see GooglePlacesAdapter): with no `apiKey` configured, `resolve` returns `null` with no network call,
 * so callers can layer this atop a static/offline resolver without branching on key presence.
 */
export declare class GooglePlacesGeocoder implements GeocoderResolver {
    private readonly apiKey?;
    private readonly fetchImpl;
    private readonly fieldMask;
    constructor({ apiKey, fetchImpl, fieldMask }?: {
        apiKey?: string;
        fetchImpl?: typeof fetch;
        fieldMask?: string;
    });
    resolve(address: string): Promise<GeocodedPlace | null>;
}
