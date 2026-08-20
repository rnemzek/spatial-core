import { test } from "node:test";
import assert from "node:assert/strict";
import { GooglePlacesAdapter, discoverNearby } from "../dist/places.js";
import { SpatialCellIndex } from "../dist/spatialCellIndex.js";

const ORIGIN = { lat: 34.2388, lng: -78.0145 };

function fakePlacesResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      places: [
        { id: "place-1", displayName: { text: "Leland Auto Gallery" }, location: { latitude: 34.24, longitude: -78.01 } },
        { id: "place-2", displayName: { text: "Coastal Motors" }, location: { latitude: 34.23, longitude: -78.02 } },
      ],
      ...overrides,
    }),
  };
}

test("fetchRaw sends the X-Goog-FieldMask header and api key when configured", async () => {
  let capturedInit: any = null;
  const fetchImpl = async (_url: string, init: any) => {
    capturedInit = init;
    return fakePlacesResponse();
  };

  const adapter = new GooglePlacesAdapter({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
  await adapter.fetchRaw({ lat: ORIGIN.lat, lng: ORIGIN.lng, radiusMeters: 5000, includedType: "car_dealer" });

  assert.equal(capturedInit.headers["X-Goog-Api-Key"], "test-key");
  assert.equal(capturedInit.headers["X-Goog-FieldMask"], "places.id,places.displayName,places.location");
});

test("normalize maps raw Places results into UnindexedFeatures", async () => {
  const adapter = new GooglePlacesAdapter({ apiKey: "test-key" });
  const raw = await fakePlacesResponse().json();
  const features = await adapter.normalize(raw);

  assert.equal(features.length, 2);
  assert.equal(features[0].id, "place-1");
  assert.equal(features[0].title, "Leland Auto Gallery");
  assert.equal(features[0].topic, "auto");
  assert.deepEqual(features[0].coordinates, { lat: 34.24, lng: -78.01 });
});

test("fetchRaw short-circuits with no network call when no apiKey is configured", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakePlacesResponse();
  };

  const adapter = new GooglePlacesAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch });
  const result = await adapter.fetchRaw({ lat: ORIGIN.lat, lng: ORIGIN.lng, radiusMeters: 5000, includedType: "car_dealer" });

  assert.equal(called, false);
  assert.deepEqual(result, { places: [] });
});

test("fetchRaw returns an empty result set on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
  const adapter = new GooglePlacesAdapter({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await adapter.fetchRaw({ lat: ORIGIN.lat, lng: ORIGIN.lng, radiusMeters: 5000, includedType: "car_dealer" });
  assert.deepEqual(result, { places: [] });
});

test("fetchRaw returns an empty result set on a malformed response body", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => { throw new Error("bad json"); } });
  const adapter = new GooglePlacesAdapter({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await adapter.fetchRaw({ lat: ORIGIN.lat, lng: ORIGIN.lng, radiusMeters: 5000, includedType: "car_dealer" });
  assert.deepEqual(result, { places: [] });
});

test("discoverNearby caches new features into the SpatialCellIndex and skips already-indexed ids", async () => {
  const fetchImpl = async () => fakePlacesResponse();
  const adapter = new GooglePlacesAdapter({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
  const index = new SpatialCellIndex();
  index.upsert({ id: "place-1", title: "Already Known", topic: "auto", coordinates: { lat: 34.24, lng: -78.01 } });

  const discovered = await discoverNearby(ORIGIN, 25, { adapter, index });

  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].id, "place-2");
  assert.ok(index.has("place-1"));
  assert.ok(index.has("place-2"));
});
