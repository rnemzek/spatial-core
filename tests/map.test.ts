import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTopicLayer, updateTopicLayer } from "../dist/map.js";
import type { SpatialMapInstance, MarkerHandle, MarkerClass, OverlayConfig, RenderTopicLayerOptions } from "../dist/map.js";
import type { LayerConfig } from "../dist/types.js";

// No jsdom in this stack: `EventTarget`/`Event` are real Node globals and stand in for a DOM element
// here, matching the addEventListener/dispatchEvent surface renderTopicLayer actually relies on.
class FakeElement extends EventTarget {}

class FakeMarker implements MarkerHandle {
  element: FakeElement;
  lngLat: [number, number] | null = null;
  addedToMap: unknown = null;
  removed = false;

  constructor({ element }: { element: FakeElement }) {
    this.element = element;
  }
  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }
  addTo(map: unknown) {
    this.addedToMap = map;
    return this;
  }
  remove() {
    this.removed = true;
    return this;
  }
}

function fakeMap(): SpatialMapInstance & { handlers: Map<string, ((event: any) => void)[]>; sources: Map<string, unknown>; layers: Set<string> } {
  const handlers = new Map<string, ((event: any) => void)[]>();
  const sources = new Map<string, unknown>();
  const layers = new Set<string>();
  return {
    handlers,
    sources,
    layers,
    addSource(id, source) {
      sources.set(id, source);
    },
    getSource(id) {
      return sources.has(id) ? { setData: (data: unknown) => sources.set(id, { ...(sources.get(id) as object), data }) } : undefined;
    },
    removeSource(id) {
      sources.delete(id);
    },
    addLayer(layer) {
      layers.add(layer.id as string);
    },
    removeLayer(id) {
      layers.delete(id);
    },
    getLayer(id) {
      return layers.has(id) ? { id } : undefined;
    },
    on(type, handler) {
      if (typeof handler !== "function") return;
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
    },
    off(type, handler) {
      if (typeof handler !== "function") return;
      const list = handlers.get(type);
      if (!list) return;
      handlers.set(type, list.filter((h) => h !== handler));
    },
  };
}

function layerConfig(): LayerConfig {
  return {
    layerId: "test-layer",
    topic: "auto",
    style: { pinColor: "#123456", icon: "car" },
    features: [
      { id: "a", title: "Dealer A", topic: "auto", coordinates: { lat: 34.1, lng: -77.9 } },
      { id: "b", title: "Dealer B", topic: "auto", coordinates: { lat: 34.2, lng: -78.0 } },
    ],
  };
}

function baseOptions(overlay: Partial<OverlayConfig> = {}): RenderTopicLayerOptions {
  return {
    MarkerClass: FakeMarker as unknown as MarkerClass,
    overlay: {
      renderMarker: () => new FakeElement() as unknown as HTMLElement,
      ...overlay,
    },
  };
}

test("renderTopicLayer creates one marker per feature via overlay.renderMarker", () => {
  const map = fakeMap();
  const config = layerConfig();
  const rendered: string[] = [];

  renderTopicLayer(map, config, baseOptions({
    renderMarker: (node) => {
      rendered.push(node.id);
      return new FakeElement() as unknown as HTMLElement;
    },
  }));

  assert.deepEqual(rendered.sort(), ["a", "b"]);
});

test("node click stops propagation and fires onNodeClick, not onMapBackgroundClick", () => {
  const map = fakeMap();
  const config = layerConfig();
  const clicked: string[] = [];
  let backgroundClicks = 0;

  const elements: FakeElement[] = [];
  renderTopicLayer(map, config, baseOptions({
    renderMarker: () => {
      const el = new FakeElement();
      elements.push(el);
      return el as unknown as HTMLElement;
    },
    onNodeClick: (node) => clicked.push(node.id),
    onMapBackgroundClick: () => backgroundClicks++,
  }));

  const clickEvent = new Event("click", { cancelable: true });
  let propagationStopped = false;
  clickEvent.stopPropagation = () => {
    propagationStopped = true;
  };
  elements[0].dispatchEvent(clickEvent);

  assert.deepEqual(clicked, ["a"]);
  assert.equal(propagationStopped, true);
  assert.equal(backgroundClicks, 0);
});

test("onMapBackgroundClick fires on a raw map click", () => {
  const map = fakeMap();
  const config = layerConfig();
  let backgroundClicks = 0;

  renderTopicLayer(map, config, baseOptions({ onMapBackgroundClick: () => backgroundClicks++ }));

  for (const handler of map.handlers.get("click") ?? []) handler({});
  assert.equal(backgroundClicks, 1);
});

test("onNodeHover and onNodeLeave fire on marker mouseenter/mouseleave", () => {
  const map = fakeMap();
  const config = layerConfig();
  const hovered: string[] = [];
  let left = 0;

  const elements: FakeElement[] = [];
  renderTopicLayer(map, config, baseOptions({
    renderMarker: () => {
      const el = new FakeElement();
      elements.push(el);
      return el as unknown as HTMLElement;
    },
    onNodeHover: (node) => hovered.push(node.id),
    onNodeLeave: () => left++,
  }));

  elements[0].dispatchEvent(new Event("mouseenter"));
  elements[0].dispatchEvent(new Event("mouseleave"));

  assert.deepEqual(hovered, ["a"]);
  assert.equal(left, 1);
});

test("showH3Overlay adds a hex source/layer, destroy tears everything down", () => {
  const map = fakeMap();
  const config = layerConfig();

  const handle = renderTopicLayer(map, config, {
    ...baseOptions(),
    showH3Overlay: true,
  });

  assert.ok(handle.hexLayerId);
  assert.ok(map.layers.has(handle.hexLayerId!));
  assert.ok(map.sources.has(handle.hexSourceId!));
  assert.equal((map.handlers.get("click") ?? []).length, 1);

  handle.destroy();

  assert.equal(map.layers.has(handle.hexLayerId!), false);
  assert.equal(map.sources.has(handle.hexSourceId!), false);
  assert.equal((map.handlers.get("click") ?? []).length, 0);
});

test("updateTopicLayer swaps markers for the new feature list", () => {
  const map = fakeMap();
  const config = layerConfig();
  let renderCount = 0;

  const options = baseOptions({
    renderMarker: () => {
      renderCount++;
      return new FakeElement() as unknown as HTMLElement;
    },
  });

  const handle = renderTopicLayer(map, config, options);
  assert.equal(renderCount, 2);

  const nextConfig: LayerConfig = {
    ...config,
    features: [{ id: "c", title: "Dealer C", topic: "auto", coordinates: { lat: 34.3, lng: -78.1 } }],
  };
  updateTopicLayer(map, nextConfig, handle, options);

  assert.equal(renderCount, 3);
});
