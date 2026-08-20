/** Raw, domain-agnostic feature handed to the engine before it has been geocoded/indexed. */
export interface UnindexedFeature {
  id: string;
  title: string;
  topic: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  /** Optional rich HTML shown in the hover tooltip/popup instead of the plain title. */
  synopsisCardHtml?: string;
  metadata?: Record<string, unknown>;
}

export interface LayerStyle {
  pinColor: string;
  icon: string;
}

/** A domain layer definition (EV chargers, car dealers, retail, ...) submitted for rendering. */
export interface LayerConfig {
  layerId: string;
  topic: string;
  style: LayerStyle;
  features: UnindexedFeature[];
}
