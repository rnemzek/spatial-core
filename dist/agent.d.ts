/** A priced, geolocated unit submitted for market comp evaluation (the target or a pool candidate). */
export interface CompTarget {
    id: string;
    price: number;
    mileage?: number;
    year?: number;
    lat: number;
    lng: number;
}
export interface MarketEvaluationResult {
    targetId: string;
    compCount: number;
    medianPrice: number;
    priceDelta: number;
    percentageDelta: number;
    verdict: "Underpriced" | "Fair Market" | "Overpriced";
    summary: string;
}
/** All H3 cell ids within `radiusKm` of `lat`/`lng`, via a grid disk sized to cover that radius. */
export declare function getNearbyCells(lat: number, lng: number, radiusKm: number): Set<string>;
/**
 * Evaluates `target`'s price against nearby comparables in `pool` within `radiusKm`, using H3 grid
 * disk membership (confirmed against exact Haversine distance) to find the local comp cluster.
 */
export declare function evaluateMarketComps(target: CompTarget, pool: CompTarget[], radiusKm?: number): MarketEvaluationResult;
