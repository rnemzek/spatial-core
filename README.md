# @nemzilla/spatial-core

Decoupled spatial layer engine: renders domain layer definitions onto a map without domain-specific business logic.

`spatial-core` gives map-based products (car dealer locators, EV charger finders, retail site selection, etc.) a shared, domain-agnostic engine for geocoding, H3 spatial indexing, map rendering, and nearby-comp pricing — while each product plugs in its own data, styling, and interaction behavior via small config objects.

## Install

```bash
npm install @nemzilla/spatial-core
```

Requires Node.js >= 20. Ships as ESM only (`"type": "module"`).

## Core concepts

- **`UnindexedFeature`** — a raw, domain-agnostic point of interest (id, title, topic, address and/or coordinates, optional HTML popup content, free-form metadata).
- **`LayerConfig`** — a named layer of features plus pin styling (`layerId`, `topic`, `style`, `features`).
- **Topics** are just strings you define (`"ev"`, `"auto"`, `"retail"`, ...) — the engine never branches on them.

Everything else in the package operates on these two shapes.

## Modules

### H3 spatial indexing (`h3.ts`)

Thin wrapper around [`h3-js`](https://github.com/uber/h3-js) for cell indexing and polygon conversion.

```ts
import { latLngToCell, gridDisk, cellToBoundary, DEFAULT_RESOLUTION } from "@nemzilla/spatial-core";

const cell = latLngToCell(37.77, -122.42); // resolution 8 by default
const neighbors = gridDisk(cell, 1); // cell + its immediate ring
const polygon = cellToBoundary(cell); // GeoJSON Polygon, [lng, lat] ring
```

### Geocoding (`geocoder.ts`)

Pluggable address → coordinate resolution. All resolvers implement `GeocoderResolver` and return `null` on failure instead of throwing.

```ts
import { geocodeAddress, GooglePlacesGeocoder, OpenStreetMapGeocoder, NullGeocoder } from "@nemzilla/spatial-core";

const google = new GooglePlacesGeocoder({ apiKey: process.env.GOOGLE_PLACES_API_KEY });
const point = await geocodeAddress("1600 Amphitheatre Pkwy, Mountain View, CA", google);

const osm = new OpenStreetMapGeocoder({ userAgent: "my-app/1.0 (contact@example.com)" });
const candidates = await osm.resolveMany("Springfield", 5); // for autocomplete UIs
```

- `GooglePlacesGeocoder` uses the Places (New) Text Search API; without an `apiKey` it resolves to `[]`/`null` with no network call.
- `OpenStreetMapGeocoder` hits Nominatim by default (no API key, 1 req/sec usage policy — set a `userAgent` on server-side call sites).
- `NullGeocoder` is the default no-op resolver, useful as a fallback.

### Map rendering (`map.ts`)

Renders a `LayerConfig` onto any MapLibre GL / Mapbox GL JS–compatible map instance. The engine owns marker lifecycle and DOM wiring; your app owns pin appearance and click/hover behavior via an `OverlayConfig`.

```ts
import { renderTopicLayer, updateTopicLayer } from "@nemzilla/spatial-core";
import maplibregl from "maplibre-gl";

const handle = renderTopicLayer(map, layerConfig, {
  MarkerClass: maplibregl.Marker,
  overlay: {
    renderMarker: (node) => buildPinElement(node),
    onNodeClick: (node) => openDetailDrawer(node),
    onMapBackgroundClick: () => closeDetailDrawer(),
  },
  showH3Overlay: true, // draw the H3 hex grid covering the layer's features beneath the pins
});

// later, after features change:
updateTopicLayer(map, updatedLayerConfig, handle, options);

// cleanup:
handle.destroy();
```

`resolveHoverContent(feature)` returns the feature's rich `synopsisCardHtml`, falling back to its plain `title`, for use in tooltips/popups.

### Nearby-cell queries & market comps (`agent.ts`)

`getNearbyCells` picks an H3 resolution sized to the requested radius and returns the covering grid-disk cells — the basis for all "what's near this point" queries in the package.

`evaluateMarketComps` prices a target against a pool of comparables within a radius, using H3 cell membership (confirmed against exact Haversine distance) to find the local comp cluster:

```ts
import { evaluateMarketComps } from "@nemzilla/spatial-core";

const result = evaluateMarketComps(target, pool, 25 /* km */);
// { targetId, compCount, medianPrice, priceDelta, percentageDelta, verdict, summary }
// verdict: "Underpriced" | "Fair Market" | "Overpriced" (±5% band around the local median)
```

### Spatial caching (`spatialCellIndex.ts`)

`SpatialCellIndex` caches geocoded features by H3 cell and tracks per-cell hydration timestamps (with optional TTL), so repeated nearby queries don't re-fetch or re-index nodes the engine already knows about.

```ts
import { SpatialCellIndex } from "@nemzilla/spatial-core";

const index = new SpatialCellIndex({ ttlMs: 1000 * 60 * 60 }); // 1 hour freshness
index.upsert(feature);
index.has(feature.id);
index.queryNearby(lat, lng, 10);
index.markCellHydrated(lat, lng);
index.isCellFresh(lat, lng);
```

### Places discovery gap-fill (`places.ts`)

`GooglePlacesAdapter` implements `IngestionAdapter` against the Places (New) `searchNearby` API. `discoverNearby` runs a "Look Far" query around an origin point, skips anything already in a `SpatialCellIndex`, caches the rest, and returns only the newly-discovered features.

```ts
import { GooglePlacesAdapter, discoverNearby } from "@nemzilla/spatial-core";

const adapter = new GooglePlacesAdapter({ apiKey: process.env.GOOGLE_PLACES_API_KEY, topic: "auto" });
const newFeatures = await discoverNearby(
  { lat: 37.77, lng: -122.42 },
  10,
  { adapter, index, includedType: "car_dealer" },
);
```

### Ingestion & validation (`ingestion/`)

`normalizePayload` validates one or many raw records against a Zod schema, silently dropping anything malformed, and returns clean `UnindexedFeature[]`. A record is valid if it has `id`, `title`, `topic`, and either `address` or `coordinates`.

```ts
import { normalizePayload } from "@nemzilla/spatial-core";

const features = normalizePayload(rawApiResponse); // array or single object
```

`IngestionAdapter` is the interface pluggable data sources implement (`providerId`, `topic`, `fetchRaw`, `normalize`) — see `GooglePlacesAdapter` for a reference implementation.

## Design notes

- **Zero domain logic in the engine.** Topics, styling, pin rendering, and click/hover behavior are all supplied by the caller; the engine never special-cases a topic string.
- **Dependency-injectable network calls.** Every class that hits an external API (`GooglePlacesGeocoder`, `OpenStreetMapGeocoder`, `GooglePlacesAdapter`) accepts an injectable `fetchImpl` and degrades to an empty/`null` result with no network call when unconfigured — safe to wire up before credentials exist.
- **H3 resolution auto-scales to radius.** `getNearbyCells`/`evaluateMarketComps` pick the coarsest H3 resolution that still fits several cells across the requested radius, rather than using a single fixed resolution for every query size.

## Development

```bash
npm run build       # tsc -> dist/
npm run typecheck    # tsc --noEmit
npm test             # builds, then runs tests/*.test.ts via node --test
```

## License

All rights reserved — see [LICENSE](./LICENSE). This is not an open-source license; the source is provided for reference within the Product Owner's own projects, not for redistribution or external reuse.
