import { test } from "node:test";
import assert from "node:assert/strict";
import { SpatialCellIndex } from "../dist/spatialCellIndex.js";
import { latLngToCell } from "../dist/h3.js";
import { getNearbyCells } from "../dist/agent.js";

const ORIGIN = { lat: 34.2388, lng: -78.0145 };

test("upsert indexes a feature and has() reflects it", () => {
  const index = new SpatialCellIndex();
  assert.equal(index.has("dealer-1"), false);

  index.upsert({ id: "dealer-1", title: "Leland Motors", topic: "auto", coordinates: ORIGIN });
  assert.equal(index.has("dealer-1"), true);
});

test("upsert no-ops for a feature without coordinates", () => {
  const index = new SpatialCellIndex();
  index.upsert({ id: "no-coords", title: "Unknown", topic: "auto" });
  assert.equal(index.has("no-coords"), false);
});

test("queryNearby returns features whose cell falls within the nearby-cell set, and excludes far-away ones", () => {
  const index = new SpatialCellIndex();
  const near = { lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng + 0.01 };
  const far = { lat: ORIGIN.lat + 5, lng: ORIGIN.lng + 5 };

  index.upsert({ id: "near-1", title: "Near Dealer", topic: "auto", coordinates: near });
  index.upsert({ id: "far-1", title: "Far Dealer", topic: "auto", coordinates: far });

  const results = index.queryNearby(ORIGIN.lat, ORIGIN.lng, 25).map((f) => f.id);
  assert.ok(results.includes("near-1"));
  assert.equal(results.includes("far-1"), false);
});

test("queryNearby cell membership is consistent with getNearbyCells/latLngToCell", () => {
  const index = new SpatialCellIndex();
  const point = { lat: ORIGIN.lat + 0.02, lng: ORIGIN.lng - 0.02 };
  index.upsert({ id: "p1", title: "Point", topic: "auto", coordinates: point });

  const nearbyCells = getNearbyCells(ORIGIN.lat, ORIGIN.lng, 25);
  const pointCell = latLngToCell(point.lat, point.lng);
  const shouldBeFound = nearbyCells.has(pointCell);

  const results = index.queryNearby(ORIGIN.lat, ORIGIN.lng, 25);
  assert.equal(results.some((f) => f.id === "p1"), shouldBeFound);
});

test("upsert overwrites a feature indexed under the same id", () => {
  const index = new SpatialCellIndex();
  index.upsert({ id: "dealer-1", title: "Old Name", topic: "auto", coordinates: ORIGIN });
  index.upsert({ id: "dealer-1", title: "New Name", topic: "auto", coordinates: ORIGIN });

  const results = index.queryNearby(ORIGIN.lat, ORIGIN.lng, 5);
  const match = results.find((f) => f.id === "dealer-1");
  assert.equal(match?.title, "New Name");
});
