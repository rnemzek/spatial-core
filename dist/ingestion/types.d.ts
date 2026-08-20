import type { UnindexedFeature } from "../types.js";
/** How trusted/stable a data source is: a public API, a private/keyed API, or a scraped web source. */
export type IngestionSourceTier = "API_PUBLIC" | "API_PRIVATE" | "WEB_SCRAPE";
/** A pluggable ingestion source. Fetches provider-native data and normalizes it into engine features. */
export interface IngestionAdapter {
    providerId: string;
    topic: "auto" | "ev" | "retail";
    fetchRaw(query: Record<string, any>): Promise<any>;
    normalize(rawData: any): Promise<UnindexedFeature[]>;
}
