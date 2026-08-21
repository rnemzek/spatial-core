export type { UnindexedFeature, LayerConfig, LayerStyle } from "./types.js";
export { DEFAULT_RESOLUTION, latLngToCell, gridDisk, cellToBoundary, getCellPolygon } from "./h3.js";
export type { GeoJSONPolygon } from "./h3.js";
export { evaluateMarketComps, getNearbyCells } from "./agent.js";
export type { CompTarget, MarketEvaluationResult } from "./agent.js";
export { geocodeAddress, NullGeocoder, GooglePlacesGeocoder } from "./geocoder.js";
export type { GeocodedPoint, GeocoderResolver, GeocodedPlace, GeocodedBoundingBox } from "./geocoder.js";
export type { IngestionSourceTier, IngestionAdapter } from "./ingestion/types.js";
export { UnindexedFeatureSchema, normalizePayload } from "./ingestion/normalizer.js";
export {
  renderTopicLayer,
  updateTopicLayer,
  resolveHoverContent,
  featuresToHexCellCollection,
} from "./map.js";
export type {
  SpatialMapInstance,
  MarkerHandle,
  MarkerClass,
  OverlayConfig,
  RenderTopicLayerOptions,
  RenderedLayerHandle,
  HexCellCollection,
} from "./map.js";
export { SpatialCellIndex } from "./spatialCellIndex.js";
export { GooglePlacesAdapter, discoverNearby } from "./places.js";
export type { PlacesSearchQuery } from "./places.js";
