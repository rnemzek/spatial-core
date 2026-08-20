import type { LayerConfig, UnindexedFeature } from "./types.js";
import { getCellPolygon, latLngToCell, DEFAULT_RESOLUTION } from "./h3.js";
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
export type HexCellCollection = GeoJSONFeatureCollection<GeoJSONPolygon, { cell: string }>;

/** Content shown in a hover tooltip/popup: the feature's rich synopsis card, falling back to its title. */
export function resolveHoverContent(feature: UnindexedFeature): string {
  return feature.synopsisCardHtml ?? feature.title;
}

/** Converts a layer's features into a GeoJSON FeatureCollection of points, skipping any without coordinates. */
export function featuresToFeatureCollection(layerConfig: LayerConfig): FeatureCollectionOf {
  const features: GeoJSONFeature<GeoJSONPoint, FeatureProperties>[] = [];

  for (const feature of layerConfig.features) {
    if (!feature.coordinates) continue;
    features.push({
      type: "Feature",
      id: feature.id,
      geometry: {
        type: "Point",
        coordinates: [feature.coordinates.lng, feature.coordinates.lat],
      },
      properties: {
        id: feature.id,
        title: feature.title,
        topic: feature.topic,
        pinColor: layerConfig.style.pinColor,
        icon: layerConfig.style.icon,
        hoverContentHtml: resolveHoverContent(feature),
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/** Builds the deduplicated H3 hexagon overlay covering every geocoded feature in a layer. */
export function featuresToHexCellCollection(
  layerConfig: LayerConfig,
  resolution: number = DEFAULT_RESOLUTION,
): HexCellCollection {
  const cells = new Set<string>();
  for (const feature of layerConfig.features) {
    if (!feature.coordinates) continue;
    cells.add(latLngToCell(feature.coordinates.lat, feature.coordinates.lng, resolution));
  }

  return {
    type: "FeatureCollection",
    features: Array.from(cells, (cell) => ({
      type: "Feature" as const,
      id: cell,
      geometry: getCellPolygon(cell),
      properties: { cell },
    })),
  };
}

/**
 * Minimal structural subset of the MapLibre GL / Mapbox GL JS `Map` API this engine relies on.
 * A real map instance from either library satisfies this shape directly, with no adapter needed.
 * Leaflet does not share this source/layer model; a thin Leaflet shim can implement the same interface.
 */
export interface SpatialMapInstance {
  addSource(id: string, source: { type: "geojson"; data: unknown }): void;
  getSource(id: string): { setData(data: unknown): void } | undefined;
  removeSource(id: string): void;
  addLayer(layer: Record<string, unknown>): void;
  removeLayer(id: string): void;
  getLayer(id: string): unknown;
  on(type: string, layerIdOrHandler: string | ((event: any) => void), handler?: (event: any) => void): void;
  off(type: string, layerIdOrHandler: string | ((event: any) => void), handler?: (event: any) => void): void;
  getCanvas?(): { style: { cursor: string } };
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

const pointLayerId = (layerId: string) => `${layerId}-points`;
const pointSourceId = (layerId: string) => `${layerId}-points-source`;
const hexLayerId = (layerId: string) => `${layerId}-hex`;
const hexSourceId = (layerId: string) => `${layerId}-hex-source`;

/**
 * Renders a LayerConfig onto a MapLibre/Mapbox-GL-compatible map instance: a GeoJSON source/layer of
 * pins styled per the layer's config, an optional H3 hexagon overlay, and hover/click interactivity.
 */
export function renderTopicLayer(
  map: SpatialMapInstance,
  layerConfig: LayerConfig,
  options: RenderTopicLayerOptions = {},
): RenderedLayerHandle {
  const layerId = pointLayerId(layerConfig.layerId);
  const sourceId = pointSourceId(layerConfig.layerId);
  const featuresById = new Map(layerConfig.features.map((feature) => [feature.id, feature]));

  map.addSource(sourceId, { type: "geojson", data: featuresToFeatureCollection(layerConfig) });

  let hexHandle: { hexLayerId: string; hexSourceId: string } | undefined;
  if (options.showH3Overlay) {
    const hexSource = hexSourceId(layerConfig.layerId);
    const hexLayer = hexLayerId(layerConfig.layerId);
    map.addSource(hexSource, {
      type: "geojson",
      data: featuresToHexCellCollection(layerConfig, options.h3Resolution),
    });
    map.addLayer({
      id: hexLayer,
      type: "fill",
      source: hexSource,
      paint: {
        "fill-color": layerConfig.style.pinColor,
        "fill-opacity": 0.15,
        "fill-outline-color": layerConfig.style.pinColor,
      },
    });
    hexHandle = { hexLayerId: hexLayer, hexSourceId: hexSource };
  }

  map.addLayer({
    id: layerId,
    type: "circle",
    source: sourceId,
    paint: {
      "circle-color": layerConfig.style.pinColor,
      "circle-radius": 6,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  const handleClick = (event: any) => {
    const featureId = event?.features?.[0]?.properties?.id;
    if (featureId) options.onFeatureSelect?.(String(featureId));
  };

  const handleMouseEnter = (event: any) => {
    if (map.getCanvas) map.getCanvas().style.cursor = "pointer";
    const featureId = event?.features?.[0]?.properties?.id;
    const feature = featureId ? featuresById.get(String(featureId)) : undefined;
    if (feature) options.onFeatureHover?.(feature, resolveHoverContent(feature));
  };

  const handleMouseLeave = () => {
    if (map.getCanvas) map.getCanvas().style.cursor = "";
    options.onFeatureHover?.(null, null);
  };

  map.on("click", layerId, handleClick);
  map.on("mouseenter", layerId, handleMouseEnter);
  map.on("mouseleave", layerId, handleMouseLeave);

  return {
    layerId,
    sourceId,
    hexLayerId: hexHandle?.hexLayerId,
    hexSourceId: hexHandle?.hexSourceId,
    destroy() {
      map.off("click", layerId, handleClick);
      map.off("mouseenter", layerId, handleMouseEnter);
      map.off("mouseleave", layerId, handleMouseLeave);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      map.removeSource(sourceId);
      if (hexHandle) {
        if (map.getLayer(hexHandle.hexLayerId)) map.removeLayer(hexHandle.hexLayerId);
        map.removeSource(hexHandle.hexSourceId);
      }
    },
  };
}

/** Re-renders a layer already added via renderTopicLayer with updated feature data, in place. */
export function updateTopicLayer(map: SpatialMapInstance, layerConfig: LayerConfig, handle: RenderedLayerHandle): void {
  map.getSource(handle.sourceId)?.setData(featuresToFeatureCollection(layerConfig));
  if (handle.hexSourceId) {
    map.getSource(handle.hexSourceId)?.setData(featuresToHexCellCollection(layerConfig));
  }
}
