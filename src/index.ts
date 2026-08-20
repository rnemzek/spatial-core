export type { UnindexedFeature, LayerConfig, LayerStyle } from "./types.js";
export { DEFAULT_RESOLUTION, latLngToCell, gridDisk, cellToBoundary, getCellPolygon } from "./h3.js";
export type { GeoJSONPolygon } from "./h3.js";
export { evaluateMarketComps, getNearbyCells } from "./agent.js";
export type { CompTarget, MarketEvaluationResult } from "./agent.js";
export { geocodeAddress, NullGeocoder } from "./geocoder.js";
export type { GeocodedPoint, GeocoderResolver } from "./geocoder.js";
export type { IngestionSourceTier, IngestionAdapter } from "./ingestion/types.js";
export { UnindexedFeatureSchema, normalizePayload } from "./ingestion/normalizer.js";
export {
  renderTopicLayer,
  updateTopicLayer,
  resolveHoverContent,
  featuresToFeatureCollection,
  featuresToHexCellCollection,
} from "./map.js";
export type {
  SpatialMapInstance,
  RenderTopicLayerOptions,
  RenderedLayerHandle,
  GeoJSONPoint,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  FeatureProperties,
} from "./map.js";
