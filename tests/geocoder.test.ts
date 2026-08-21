import { test } from "node:test";
import assert from "node:assert/strict";
import { NullGeocoder, geocodeAddress, GooglePlacesGeocoder } from "../dist/geocoder.js";

function fakeTextSearchResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      places: [
        {
          location: { latitude: 30.4213, longitude: -87.2169 },
          displayName: { text: "Pensacola, FL" },
          formattedAddress: "Pensacola, FL, USA",
          viewport: {
            low: { latitude: 30.35, longitude: -87.32 },
            high: { latitude: 30.52, longitude: -87.14 },
          },
        },
      ],
      ...overrides,
    }),
  };
}

test("NullGeocoder/geocodeAddress default resolves to null with no resolver configured", async () => {
  assert.equal(await geocodeAddress("Pensacola, FL"), null);
  assert.equal(await new NullGeocoder().resolve("Pensacola, FL"), null);
});

test("geocodeAddress returns null for blank input without invoking the resolver", async () => {
  let called = false;
  const resolver = { resolve: async () => { called = true; return { lat: 1, lng: 1 }; } };
  assert.equal(await geocodeAddress("   ", resolver), null);
  assert.equal(called, false);
});

test("GooglePlacesGeocoder.resolve short-circuits with no network call when no apiKey is configured", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return fakeTextSearchResponse(); };
  const geocoder = new GooglePlacesGeocoder({ fetchImpl: fetchImpl as unknown as typeof fetch });

  assert.equal(await geocoder.resolve("Pensacola, FL"), null);
  assert.equal(called, false);
});

test("GooglePlacesGeocoder.resolve sends textQuery and the field mask/api key headers", async () => {
  let capturedUrl: string | null = null;
  let capturedInit: any = null;
  const fetchImpl = async (url: string, init: any) => {
    capturedUrl = url;
    capturedInit = init;
    return fakeTextSearchResponse();
  };

  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
  await geocoder.resolve("Pensacola, FL");

  assert.equal(capturedUrl, "https://places.googleapis.com/v1/places:searchText");
  assert.equal(capturedInit.headers["X-Goog-Api-Key"], "test-key");
  assert.equal(
    capturedInit.headers["X-Goog-FieldMask"],
    "places.location,places.displayName,places.formattedAddress,places.viewport",
  );
  assert.deepEqual(JSON.parse(capturedInit.body), { textQuery: "Pensacola, FL" });
});

test("GooglePlacesGeocoder.resolve maps a matched place to lat/lng, display metadata, and boundingBox", async () => {
  const geocoder = new GooglePlacesGeocoder({
    apiKey: "test-key",
    fetchImpl: (async () => fakeTextSearchResponse()) as unknown as typeof fetch,
  });

  const result = await geocoder.resolve("Pensacola, FL");

  assert.deepEqual(result, {
    lat: 30.4213,
    lng: -87.2169,
    displayName: "Pensacola, FL",
    formattedAddress: "Pensacola, FL, USA",
    boundingBox: { south: 30.35, west: -87.32, north: 30.52, east: -87.14 },
  });
});

test("GooglePlacesGeocoder.resolve omits boundingBox when no viewport is present", async () => {
  const geocoder = new GooglePlacesGeocoder({
    apiKey: "test-key",
    fetchImpl: (async () =>
      fakeTextSearchResponse({
        places: [{ location: { latitude: 1, longitude: 2 }, displayName: { text: "Somewhere" } }],
      })) as unknown as typeof fetch,
  });

  const result = await geocoder.resolve("Somewhere");
  assert.deepEqual(result, { lat: 1, lng: 2, displayName: "Somewhere", formattedAddress: "Somewhere", boundingBox: undefined });
});

test("GooglePlacesGeocoder.resolve returns null for an empty/whitespace query without a network call", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return fakeTextSearchResponse(); };
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  assert.equal(await geocoder.resolve("   "), null);
  assert.equal(called, false);
});

test("GooglePlacesGeocoder.resolve returns null on a non-ok response", async () => {
  const geocoder = new GooglePlacesGeocoder({
    apiKey: "test-key",
    fetchImpl: (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch,
  });

  assert.equal(await geocoder.resolve("Nowhere"), null);
});

test("GooglePlacesGeocoder.resolve returns null when the response body is unparseable", async () => {
  const geocoder = new GooglePlacesGeocoder({
    apiKey: "test-key",
    fetchImpl: (async () => ({ ok: true, json: async () => { throw new Error("bad json"); } })) as unknown as typeof fetch,
  });

  assert.equal(await geocoder.resolve("Nowhere"), null);
});

test("GooglePlacesGeocoder.resolve returns null when no places are found", async () => {
  const geocoder = new GooglePlacesGeocoder({
    apiKey: "test-key",
    fetchImpl: (async () => fakeTextSearchResponse({ places: [] })) as unknown as typeof fetch,
  });

  assert.equal(await geocoder.resolve("Nowhereville"), null);
});
