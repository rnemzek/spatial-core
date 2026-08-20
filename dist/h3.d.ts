/** Default H3 resolution used across the engine (~0.46 km2 hexagons). */
export declare const DEFAULT_RESOLUTION = 8;
/** Index a lat/lng point to its H3 cell at the given resolution (default res 8). */
export declare function latLngToCell(lat: number, lng: number, resolution?: number): string;
/** All cells within `radius` grid steps of `cell`, including `cell` itself. */
export declare function gridDisk(cell: string, radius: number): string[];
export interface GeoJSONPolygon {
    type: "Polygon";
    coordinates: number[][][];
}
/** Convert an H3 cell to a GeoJSON Polygon (ring in [lng, lat] order, closed). */
export declare function cellToBoundary(cell: string): GeoJSONPolygon;
/** Alias for cellToBoundary, matching the naming used by map-rendering call sites. */
export declare const getCellPolygon: typeof cellToBoundary;
