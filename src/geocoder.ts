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
