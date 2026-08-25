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
/**
 * OpenStreetMap (Nominatim) resolver — a zero-cost, no-API-key alternative to GooglePlacesGeocoder.
 * Accepts free-form queries (street addresses, ZIP codes, "City, ST") and resolves the first match.
 * Dependency-injectable `fetchImpl` (default bound to `globalThis`, per GooglePlacesGeocoder's
 * "Illegal invocation" note above), `baseUrl` (to target a self-hosted instance or Photon-compatible
 * endpoint), and an optional `userAgent` — Nominatim's usage policy asks for a custom User-Agent/Referer
 * identifying the calling app, capped at 1 req/sec with no bulk use; browsers forbid scripts from
 * setting the User-Agent header via fetch, so this is a no-op there and only takes effect for
 * server-side/Node call sites.
 *
 * Nominatim's response quirks this normalizes away: `lat`/`lon` are strings, not numbers, and
 * `boundingbox` is `[south, north, west, east]` (Google's viewport is `{north,south,east,west}`) — get
 * either wrong and you silently get NaN coordinates or a transposed bounding box.
 */
export declare class OpenStreetMapGeocoder implements GeocoderResolver {
    private readonly baseUrl;
    private readonly fetchImpl;
    private readonly userAgent?;
    constructor({ baseUrl, fetchImpl, userAgent }?: {
        baseUrl?: string;
        fetchImpl?: typeof fetch;
        userAgent?: string;
    });
    resolve(address: string): Promise<GeocodedPlace | null>;
}
