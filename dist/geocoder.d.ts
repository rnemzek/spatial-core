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
