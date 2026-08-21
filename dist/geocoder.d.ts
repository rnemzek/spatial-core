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
export declare class NullGeocoder implements GeocoderResolver {
    resolve(_address: string): Promise<GeocodedPoint | null>;
}
/** Resolve an address using the given resolver (defaults to a no-op resolver). */
export declare function geocodeAddress(address: string, resolver?: GeocoderResolver): Promise<GeocodedPoint | null>;
/**
 * Google Places (New) `searchText` adapter — resolves a free-form query ("Pensacola, FL", "32501",
 * a street address, ...) to a coordinate plus display metadata. Dependency-injectable `fetchImpl`/
 * `apiKey`, matching this stack's existing pluggable-fallback pattern: with no `apiKey` configured,
 * `resolve` returns `null` with no network call.
 */
export declare class GooglePlacesGeocoder implements GeocoderResolver {
    private readonly apiKey?;
    private readonly fetchImpl;
    constructor({ apiKey, fetchImpl }?: {
        apiKey?: string;
        fetchImpl?: typeof fetch;
    });
    resolve(address: string): Promise<GeocodedPoint | null>;
}
