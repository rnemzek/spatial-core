import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateMarketComps, getNearbyCells } from "../dist/agent.js";
import type { CompTarget } from "../dist/agent.js";

// Charlotte, NC anchor with a tight cluster of comps a few km away.
const TARGET_ORIGIN = { lat: 35.2271, lng: -80.8431 };

function comp(id: string, price: number, latOffset: number, lngOffset: number): CompTarget {
  return { id, price, lat: TARGET_ORIGIN.lat + latOffset, lng: TARGET_ORIGIN.lng + lngOffset };
}

test("evaluateMarketComps flags a target priced well below the local median as Underpriced", () => {
  const target = comp("target", 15000, 0, 0);
  const pool = [
    target,
    comp("c1", 20000, 0.01, 0.01),
    comp("c2", 20500, -0.01, 0.01),
    comp("c3", 19800, 0.01, -0.01),
  ];

  const result = evaluateMarketComps(target, pool, 25);

  assert.equal(result.targetId, "target");
  assert.equal(result.compCount, 3);
  assert.equal(result.medianPrice, 20000);
  assert.equal(result.priceDelta, -5000);
  assert.equal(result.verdict, "Underpriced");
  assert.match(result.summary, /\$5,000 below/);
});

test("evaluateMarketComps flags a target priced well above the local median as Overpriced", () => {
  const target = comp("target", 26000, 0, 0);
  const pool = [target, comp("c1", 20000, 0.01, 0.01), comp("c2", 20000, -0.01, 0.01)];

  const result = evaluateMarketComps(target, pool, 25);

  assert.equal(result.verdict, "Overpriced");
  assert.match(result.summary, /above/);
});

test("evaluateMarketComps treats a target within the fair-market band as Fair Market", () => {
  const target = comp("target", 20500, 0, 0);
  const pool = [target, comp("c1", 20000, 0.01, 0.01), comp("c2", 20200, -0.01, 0.01)];

  const result = evaluateMarketComps(target, pool, 25);

  assert.equal(result.verdict, "Fair Market");
});

test("evaluateMarketComps excludes comps outside the requested radius", () => {
  const target = comp("target", 15000, 0, 0);
  const farAway: CompTarget = { id: "far", price: 99000, lat: 40.7128, lng: -74.006 }; // NYC, far from Charlotte
  const pool = [target, farAway, comp("near", 20000, 0.01, 0.01)];

  const result = evaluateMarketComps(target, pool, 25);

  assert.equal(result.compCount, 1);
  assert.equal(result.medianPrice, 20000);
});

test("evaluateMarketComps excludes the target itself even if present in the pool", () => {
  const target = comp("target", 20000, 0, 0);
  const result = evaluateMarketComps(target, [target], 25);
  assert.equal(result.compCount, 0);
});

test("evaluateMarketComps reports Fair Market with no comps when the pool has no nearby matches", () => {
  const target = comp("target", 20000, 0, 0);
  const result = evaluateMarketComps(target, [], 25);

  assert.equal(result.compCount, 0);
  assert.equal(result.verdict, "Fair Market");
  assert.match(result.summary, /No comparable listings/);
});

test("getNearbyCells returns a non-empty set of H3 cell ids covering the origin", () => {
  const cells = getNearbyCells(TARGET_ORIGIN.lat, TARGET_ORIGIN.lng, 25);
  assert.ok(cells.size > 0);
});
