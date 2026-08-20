import type { LayerConfig, UnindexedFeature } from "./types.js";
import { getCellPolygon, latLngToCell, DEFAULT_RESOLUTION } from "./h3.js";
import type { GeoJSONPolygon } from "./h3.js";

export type HexCellCollection = {
  type: "FeatureCollection";
  features: Array<{ type: "Feature"; id: string; geometry: GeoJSONPolygon; properties: { cell: string } }>;
};

/** Content shown in a hover tooltip/popup: the feature's rich synopsis card, falling back to its title. */
export function resolveHoverContent(feature: UnindexedFeature): string {
  return feature.synopsisCardHtml ?? feature.title;
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
 * Minimal structural subset of the MapLibre GL / Mapbox GL JS `Map` API this engine relies on for
 * canvas mechanics (H3 hex overlay source/layer + the background-click listener). A real map instance
 * from either library satisfies this shape directly, with no adapter needed.
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
}

/** Minimal structural subset of the MapLibre GL / Mapbox GL JS `Marker` instance API. */
export interface MarkerHandle {
  setLngLat(lngLat: [number, number]): unknown;
  addTo(map: unknown): unknown;
  remove(): unknown;
}

/** Minimal structural subset of the MapLibre GL / Mapbox GL JS `Marker` constructor. */
export type MarkerClass = new (options: { element: HTMLElement }) => MarkerHandle;

/**
 * Domain overlay plugged into the engine: owns pin appearance (`renderMarker`) and the domain-level
 * click/hover behavior for map nodes. The engine handles marker lifecycle and DOM wiring; the overlay
 * only describes what a node looks like and what should happen when it's interacted with.
 */
export interface OverlayConfig {
  /** Returns the DOM/SVG element rendered for a node's pin. Called once per feature per render. */
  renderMarker(node: UnindexedFeature): HTMLElement;
  /** Emitted on a node click. The engine calls `event.stopPropagation()` first to isolate it from the map canvas. */
  onNodeClick?(node: UnindexedFeature): void;
  /** Emitted when a node's pin is hovered. */
  onNodeHover?(node: UnindexedFeature): void;
  /** Emitted when a hovered node's pin is left. */
  onNodeLeave?(): void;
  /** Emitted when the non-navigable map canvas (not a node) is clicked, e.g. to dismiss an active drawer. */
  onMapBackgroundClick?(): void;
}

export interface RenderTopicLayerOptions {
  /** Domain overlay describing pin appearance and node click/hover behavior. Required. */
  overlay: OverlayConfig;
  /** Marker constructor from the host map library (e.g. `maplibregl.Marker`). Required. */
  MarkerClass: MarkerClass;
  /** Renders the H3 hexagon cells covering this layer's features beneath the pins. Defaults to false. */
  showH3Overlay?: boolean;
  /** H3 resolution used for the hexagon overlay. Defaults to DEFAULT_RESOLUTION (8). */
  h3Resolution?: number;
}

export interface RenderedLayerHandle {
  hexLayerId?: string;
  hexSourceId?: string;
  /** Removes this layer's pins, hexagon overlay, and event listeners from the map. */
  destroy(): void;
}

const hexLayerId = (layerId: string) => `${layerId}-hex`;
const hexSourceId = (layerId: string) => `${layerId}-hex-source`;

function attachMarker(feature: UnindexedFeature, map: SpatialMapInstance, options: RenderTopicLayerOptions): MarkerHandle | null {
  if (!feature.coordinates) return null;
  const { overlay, MarkerClass } = options;

  const element = overlay.renderMarker(feature);
  element.addEventListener("click", (event: MouseEvent) => {
    event.stopPropagation();
    overlay.onNodeClick?.(feature);
  });
  element.addEventListener("mouseenter", () => overlay.onNodeHover?.(feature));
  element.addEventListener("mouseleave", () => overlay.onNodeLeave?.());

  const marker = new MarkerClass({ element });
  marker.setLngLat([feature.coordinates.lng, feature.coordinates.lat]);
  marker.addTo(map);
  return marker;
}

/**
 * Renders a LayerConfig onto a MapLibre/Mapbox-GL-compatible map instance: one DOM marker per feature
 * (appearance and behavior owned by the domain `overlay`), an optional H3 hexagon overlay beneath them,
 * and a background-click listener isolated from node clicks via `stopPropagation`.
 */
export function renderTopicLayer(
  map: SpatialMapInstance,
  layerConfig: LayerConfig,
  options: RenderTopicLayerOptions,
): RenderedLayerHandle {
  const markers = new Map<string, MarkerHandle>();
  for (const feature of layerConfig.features) {
    const marker = attachMarker(feature, map, options);
    if (marker) markers.set(feature.id, marker);
  }

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

  const handleBackgroundClick = () => options.overlay.onMapBackgroundClick?.();
  map.on("click", handleBackgroundClick);

  return {
    hexLayerId: hexHandle?.hexLayerId,
    hexSourceId: hexHandle?.hexSourceId,
    destroy() {
      map.off("click", handleBackgroundClick);
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      if (hexHandle) {
        if (map.getLayer(hexHandle.hexLayerId)) map.removeLayer(hexHandle.hexLayerId);
        map.removeSource(hexHandle.hexSourceId);
      }
    },
  };
}

/**
 * Re-renders a layer already added via renderTopicLayer with updated feature data: swaps out all
 * markers for the new feature list and refreshes the H3 hex overlay data in place.
 */
export function updateTopicLayer(
  map: SpatialMapInstance,
  layerConfig: LayerConfig,
  handle: RenderedLayerHandle,
  options: RenderTopicLayerOptions,
): void {
  handle.destroy();
  const rerendered = renderTopicLayer(map, layerConfig, options);
  handle.hexLayerId = rerendered.hexLayerId;
  handle.hexSourceId = rerendered.hexSourceId;
  handle.destroy = rerendered.destroy;
}
