import type { LayerConfig, UnindexedFeature } from "./types.js";
import type { GeoJSONPolygon } from "./h3.js";
export interface GeoJSONPoint {
    type: "Point";
    coordinates: [number, number];
}
export interface GeoJSONFeature<Geometry, Properties> {
    type: "Feature";
    id: string;
    geometry: Geometry;
    properties: Properties;
}
export interface GeoJSONFeatureCollection<Geometry, Properties> {
    type: "FeatureCollection";
    features: GeoJSONFeature<Geometry, Properties>[];
}
export interface FeatureProperties {
    id: string;
    title: string;
    topic: string;
    pinColor: string;
    icon: string;
    hoverContentHtml: string;
}
export type FeatureCollectionOf = GeoJSONFeatureCollection<GeoJSONPoint, FeatureProperties>;
export type HexCellCollection = GeoJSONFeatureCollection<GeoJSONPolygon, {
    cell: string;
}>;
/** Content shown in a hover tooltip/popup: the feature's rich synopsis card, falling back to its title. */
export declare function resolveHoverContent(feature: UnindexedFeature): string;
/** Converts a layer's features into a GeoJSON FeatureCollection of points, skipping any without coordinates. */
export declare function featuresToFeatureCollection(layerConfig: LayerConfig): FeatureCollectionOf;
/** Builds the deduplicated H3 hexagon overlay covering every geocoded feature in a layer. */
export declare function featuresToHexCellCollection(layerConfig: LayerConfig, resolution?: number): HexCellCollection;
/**
 * Minimal structural subset of the MapLibre GL / Mapbox GL JS `Map` API this engine relies on.
 * A real map instance from either library satisfies this shape directly, with no adapter needed.
 * Leaflet does not share this source/layer model; a thin Leaflet shim can implement the same interface.
 */
export interface SpatialMapInstance {
    addSource(id: string, source: {
        type: "geojson";
        data: unknown;
    }): void;
    getSource(id: string): {
        setData(data: unknown): void;
    } | undefined;
    removeSource(id: string): void;
    addLayer(layer: Record<string, unknown>): void;
    removeLayer(id: string): void;
    getLayer(id: string): unknown;
    on(type: string, layerIdOrHandler: string | ((event: any) => void), handler?: (event: any) => void): void;
    off(type: string, layerIdOrHandler: string | ((event: any) => void), handler?: (event: any) => void): void;
    getCanvas?(): {
        style: {
            cursor: string;
        };
    };
}
export interface RenderTopicLayerOptions {
    /** Called with the feature's id when a pin on this layer is clicked. */
    onFeatureSelect?: (featureId: string) => void;
    /** Called with the hovered feature (and its resolved hover content) on hover-in, and `null` on hover-out. */
    onFeatureHover?: (feature: UnindexedFeature | null, hoverContentHtml: string | null) => void;
    /** Renders the H3 hexagon cells covering this layer's features beneath the pins. Defaults to false. */
    showH3Overlay?: boolean;
    /** H3 resolution used for the hexagon overlay. Defaults to DEFAULT_RESOLUTION (8). */
    h3Resolution?: number;
}
export interface RenderedLayerHandle {
    layerId: string;
    sourceId: string;
    hexLayerId?: string;
    hexSourceId?: string;
    /** Removes this layer's pins, hexagon overlay, and event listeners from the map. */
    destroy(): void;
}
/**
 * Renders a LayerConfig onto a MapLibre/Mapbox-GL-compatible map instance: a GeoJSON source/layer of
 * pins styled per the layer's config, an optional H3 hexagon overlay, and hover/click interactivity.
 */
export declare function renderTopicLayer(map: SpatialMapInstance, layerConfig: LayerConfig, options?: RenderTopicLayerOptions): RenderedLayerHandle;
/** Re-renders a layer already added via renderTopicLayer with updated feature data, in place. */
export declare function updateTopicLayer(map: SpatialMapInstance, layerConfig: LayerConfig, handle: RenderedLayerHandle): void;
