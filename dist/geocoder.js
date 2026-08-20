/** No-op resolver useful as a default/fallback when no geocoding backend is configured. */
export class NullGeocoder {
    async resolve(_address) {
        return null;
    }
}
/** Resolve an address using the given resolver (defaults to a no-op resolver). */
export async function geocodeAddress(address, resolver = new NullGeocoder()) {
    if (!address.trim())
        return null;
    return resolver.resolve(address);
}
