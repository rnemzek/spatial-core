import { test } from "node:test";
import assert from "node:assert/strict";
import { GooglePlacesGeocoder, geocodeAddress, NullGeocoder } from "../dist/geocoder.js";

function fakeGeocodeResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      places: [
        {
          id: "place-pensacola",
          displayName: { text: "Pensacola, Florida" },
          formattedAddress: "Pensacola, FL, USA",
          location: { latitude: 30.4213, longitude: -87.2169 },
          viewport: {
            low: { latitude: 30.3, longitude: -87.35 },
            high: { latitude: 30.55, longitude: -87.1 },
          },
        },
      ],
      ...overrides,
    }),
  };
}

test("resolve sends the X-Goog-FieldMask header and api key when configured", async () => {
  let capturedUrl: string | null = null;
  let capturedInit: any = null;
  const fetchImpl = async (url: string, init: any) => {
    capturedUrl = url;
    capturedInit = init;
    return fakeGeocodeResponse();
  };

  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
  await geocoder.resolve("Pensacola, FL");

  assert.equal(capturedUrl, "https://places.googleapis.com/v1/places:searchText");
  assert.equal(capturedInit.headers["X-Goog-Api-Key"], "test-key");
  assert.equal(
    capturedInit.headers["X-Goog-FieldMask"],
    "places.id,places.displayName,places.formattedAddress,places.location,places.viewport",
  );
  assert.deepEqual(JSON.parse(capturedInit.body), { textQuery: "Pensacola, FL" });
});

test("resolve maps a Places Text Search result into a GeocodedPoint with displayName/formattedAddress/boundingBox", async () => {
  const fetchImpl = async () => fakeGeocodeResponse();
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await geocoder.resolve("Pensacola, FL");

  assert.deepEqual(result, {
    lat: 30.4213,
    lng: -87.2169,
    displayName: "Pensacola, Florida",
    formattedAddress: "Pensacola, FL, USA",
    boundingBox: { north: 30.55, south: 30.3, east: -87.1, west: -87.35 },
  });
});

test("resolve works for a ZIP-code query the same way as a city query", async () => {
  const fetchImpl = async () => fakeGeocodeResponse();
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await geocoder.resolve("32501");

  assert.equal(result?.lat, 30.4213);
  assert.equal(result?.lng, -87.2169);
});

test("resolve omits boundingBox when the response has no viewport", async () => {
  const fetchImpl = async () =>
    fakeGeocodeResponse({
      places: [
        { id: "place-1", displayName: { text: "Somewhere" }, location: { latitude: 1, longitude: 2 } },
      ],
    });
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await geocoder.resolve("Somewhere");
  assert.equal(result?.boundingBox, undefined);
});

test("resolve returns null with no network call when no apiKey is configured", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeGeocodeResponse();
  };

  const geocoder = new GooglePlacesGeocoder({ fetchImpl: fetchImpl as unknown as typeof fetch });
  const result = await geocoder.resolve("Pensacola, FL");

  assert.equal(called, false);
  assert.equal(result, null);
});

test("resolve returns null for a blank address without a network call", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeGeocodeResponse();
  };

  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
  const result = await geocoder.resolve("   ");

  assert.equal(called, false);
  assert.equal(result, null);
});

test("resolve returns null on a non-ok response", async () => {
  const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await geocoder.resolve("Pensacola, FL");
  assert.equal(result, null);
});

test("resolve returns null on a malformed response body", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => { throw new Error("bad json"); } });
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await geocoder.resolve("Pensacola, FL");
  assert.equal(result, null);
});

test("resolve returns null when the response has no places", async () => {
  const fetchImpl = async () => fakeGeocodeResponse({ places: [] });
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await geocoder.resolve("Nowhereville");
  assert.equal(result, null);
});

test("geocodeAddress delegates to the given resolver", async () => {
  const fetchImpl = async () => fakeGeocodeResponse();
  const geocoder = new GooglePlacesGeocoder({ apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });

  const result = await geocodeAddress("Pensacola, FL", geocoder);
  assert.equal(result?.displayName, "Pensacola, Florida");
});

test("geocodeAddress returns null for blank input without invoking the resolver", async () => {
  const result = await geocodeAddress("   ", new NullGeocoder());
  assert.equal(result, null);
});
