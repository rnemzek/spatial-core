import { test } from "node:test";
import assert from "node:assert/strict";
import { NullGeocoder, geocodeAddress, GooglePlacesGeocoder, OpenStreetMapGeocoder } from "../dist/geocoder.js";

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

function fakeNominatimResponse(overrides: any[] | null = null) {
  return {
    ok: true,
    json: async () =>
      overrides ?? [
        {
          lat: "30.4213",
          lon: "-87.2169",
          name: "Pensacola",
          display_name: "Pensacola, Escambia County, Florida, United States",
          boundingbox: ["30.35", "30.52", "-87.32", "-87.14"],
        },
      ],
  };
}

test("OpenStreetMapGeocoder.resolve requires no apiKey — sends a network request unconditionally", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeNominatimResponse();
  };
  const geocoder = new OpenStreetMapGeocoder({ fetchImpl: fetchImpl as unknown as typeof fetch });

  await geocoder.resolve("Pensacola, FL");
  assert.equal(called, true);
});

test("OpenStreetMapGeocoder.resolve sends format/q/limit query params against the Nominatim search endpoint", async () => {
  let capturedUrl: string | null = null;
  let capturedInit: any = null;
  const fetchImpl = async (url: string, init: any) => {
    capturedUrl = url;
    capturedInit = init;
    return fakeNominatimResponse();
  };

  const geocoder = new OpenStreetMapGeocoder({ fetchImpl: fetchImpl as unknown as typeof fetch });
  await geocoder.resolve("Pensacola, FL");

  const url = new URL(capturedUrl as unknown as string);
  assert.equal(url.origin + url.pathname, "https://nominatim.openstreetmap.org/search");
  assert.equal(url.searchParams.get("format"), "jsonv2");
  assert.equal(url.searchParams.get("q"), "Pensacola, FL");
  assert.equal(url.searchParams.get("limit"), "1");
  assert.equal(capturedInit.headers["User-Agent"], undefined);
});

test("OpenStreetMapGeocoder.resolve sets a User-Agent header when configured, and honors a custom baseUrl", async () => {
  let capturedUrl: string | null = null;
  let capturedInit: any = null;
  const fetchImpl = async (url: string, init: any) => {
    capturedUrl = url;
    capturedInit = init;
    return fakeNominatimResponse();
  };

  const geocoder = new OpenStreetMapGeocoder({
    baseUrl: "https://nominatim.example.internal/search",
    userAgent: "carboyz/1.0 (hello@carboyzmotors.example)",
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  await geocoder.resolve("Pensacola, FL");

  assert.ok((capturedUrl as unknown as string).startsWith("https://nominatim.example.internal/search"));
  assert.equal(capturedInit.headers["User-Agent"], "carboyz/1.0 (hello@carboyzmotors.example)");
});

test("OpenStreetMapGeocoder.resolve parses Nominatim's string lat/lon into numbers, and boundingbox's [south,north,west,east] order into a GeocodedBoundingBox", async () => {
  const geocoder = new OpenStreetMapGeocoder({
    fetchImpl: (async () => fakeNominatimResponse()) as unknown as typeof fetch,
  });

  const result = await geocoder.resolve("Pensacola, FL");

  assert.deepEqual(result, {
    lat: 30.4213,
    lng: -87.2169,
    displayName: "Pensacola",
    formattedAddress: "Pensacola, Escambia County, Florida, United States",
    boundingBox: { south: 30.35, north: 30.52, west: -87.32, east: -87.14 },
  });
});

test("OpenStreetMapGeocoder.resolve falls back to display_name for displayName when no name field is present", async () => {
  const geocoder = new OpenStreetMapGeocoder({
    fetchImpl: (async () =>
      fakeNominatimResponse([
        { lat: "1", lon: "2", display_name: "Somewhere, Nowhere County" },
      ])) as unknown as typeof fetch,
  });

  const result = await geocoder.resolve("Somewhere");
  assert.deepEqual(result, {
    lat: 1,
    lng: 2,
    displayName: "Somewhere, Nowhere County",
    formattedAddress: "Somewhere, Nowhere County",
    boundingBox: undefined,
  });
});

test("OpenStreetMapGeocoder.resolve returns null for an empty/whitespace query without a network call", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return fakeNominatimResponse();
  };
  const geocoder = new OpenStreetMapGeocoder({ fetchImpl: fetchImpl as unknown as typeof fetch });

  assert.equal(await geocoder.resolve("   "), null);
  assert.equal(called, false);
});

test("OpenStreetMapGeocoder.resolve returns null on a non-ok response", async () => {
  const geocoder = new OpenStreetMapGeocoder({
    fetchImpl: (async () => ({ ok: false, json: async () => ([]) })) as unknown as typeof fetch,
  });

  assert.equal(await geocoder.resolve("Nowhere"), null);
});

test("OpenStreetMapGeocoder.resolve returns null when the response body is unparseable", async () => {
  const geocoder = new OpenStreetMapGeocoder({
    fetchImpl: (async () => ({ ok: true, json: async () => { throw new Error("bad json"); } })) as unknown as typeof fetch,
  });

  assert.equal(await geocoder.resolve("Nowhere"), null);
});

test("OpenStreetMapGeocoder.resolve returns null when no results are found", async () => {
  const geocoder = new OpenStreetMapGeocoder({
    fetchImpl: (async () => fakeNominatimResponse([])) as unknown as typeof fetch,
  });

  assert.equal(await geocoder.resolve("Nowhereville"), null);
});

test("OpenStreetMapGeocoder.resolve returns null when lat/lon are unparseable as numbers", async () => {
  const geocoder = new OpenStreetMapGeocoder({
    fetchImpl: (async () => fakeNominatimResponse([{ lat: "not-a-number", lon: "-87.2169" }])) as unknown as typeof fetch,
  });

  assert.equal(await geocoder.resolve("Nowhere"), null);
});
