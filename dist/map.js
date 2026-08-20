import { getCellPolygon, latLngToCell, DEFAULT_RESOLUTION } from "./h3.js";
/** Content shown in a hover tooltip/popup: the feature's rich synopsis card, falling back to its title. */
export function resolveHoverContent(feature) {
    return feature.synopsisCardHtml ?? feature.title;
}
/** Converts a layer's features into a GeoJSON FeatureCollection of points, skipping any without coordinates. */
export function featuresToFeatureCollection(layerConfig) {
    const features = [];
    for (const feature of layerConfig.features) {
        if (!feature.coordinates)
            continue;
        features.push({
            type: "Feature",
            id: feature.id,
            geometry: {
                type: "Point",
                coordinates: [feature.coordinates.lng, feature.coordinates.lat],
            },
            properties: {
                id: feature.id,
                title: feature.title,
                topic: feature.topic,
                pinColor: layerConfig.style.pinColor,
                icon: layerConfig.style.icon,
                hoverContentHtml: resolveHoverContent(feature),
            },
        });
    }
    return { type: "FeatureCollection", features };
}
/** Builds the deduplicated H3 hexagon overlay covering every geocoded feature in a layer. */
export function featuresToHexCellCollection(layerConfig, resolution = DEFAULT_RESOLUTION) {
    const cells = new Set();
    for (const feature of layerConfig.features) {
        if (!feature.coordinates)
            continue;
        cells.add(latLngToCell(feature.coordinates.lat, feature.coordinates.lng, resolution));
    }
    return {
        type: "FeatureCollection",
        features: Array.from(cells, (cell) => ({
            type: "Feature",
            id: cell,
            geometry: getCellPolygon(cell),
            properties: { cell },
        })),
    };
}
const pointLayerId = (layerId) => `${layerId}-points`;
const pointSourceId = (layerId) => `${layerId}-points-source`;
const hexLayerId = (layerId) => `${layerId}-hex`;
const hexSourceId = (layerId) => `${layerId}-hex-source`;
/**
 * Renders a LayerConfig onto a MapLibre/Mapbox-GL-compatible map instance: a GeoJSON source/layer of
 * pins styled per the layer's config, an optional H3 hexagon overlay, and hover/click interactivity.
 */
export function renderTopicLayer(map, layerConfig, options = {}) {
    const layerId = pointLayerId(layerConfig.layerId);
    const sourceId = pointSourceId(layerConfig.layerId);
    const featuresById = new Map(layerConfig.features.map((feature) => [feature.id, feature]));
    map.addSource(sourceId, { type: "geojson", data: featuresToFeatureCollection(layerConfig) });
    let hexHandle;
    if (options.showH3Overlay) {
        const hexSource = hexSourceId(layerConfig.layerId);
        const hexLayer = hexLayerId(layerConfig.layerId);
        map.addSource(hexSource, {
            type: "geojson",
            data: featuresToHexCellCollection(layerConfig, options.h3Resolution),
        });
        map.addLayer({
            id: hexLayer,
            type: "fill",
            source: hexSource,
            paint: {
                "fill-color": layerConfig.style.pinColor,
                "fill-opacity": 0.15,
                "fill-outline-color": layerConfig.style.pinColor,
            },
        });
        hexHandle = { hexLayerId: hexLayer, hexSourceId: hexSource };
    }
    map.addLayer({
        id: layerId,
        type: "circle",
        source: sourceId,
        paint: {
            "circle-color": layerConfig.style.pinColor,
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
        },
    });
    const handleClick = (event) => {
        const featureId = event?.features?.[0]?.properties?.id;
        if (featureId)
            options.onFeatureSelect?.(String(featureId));
    };
    const handleMouseEnter = (event) => {
        if (map.getCanvas)
            map.getCanvas().style.cursor = "pointer";
        const featureId = event?.features?.[0]?.properties?.id;
        const feature = featureId ? featuresById.get(String(featureId)) : undefined;
        if (feature)
            options.onFeatureHover?.(feature, resolveHoverContent(feature));
    };
    const handleMouseLeave = () => {
        if (map.getCanvas)
            map.getCanvas().style.cursor = "";
        options.onFeatureHover?.(null, null);
    };
    map.on("click", layerId, handleClick);
    map.on("mouseenter", layerId, handleMouseEnter);
    map.on("mouseleave", layerId, handleMouseLeave);
    return {
        layerId,
        sourceId,
        hexLayerId: hexHandle?.hexLayerId,
        hexSourceId: hexHandle?.hexSourceId,
        destroy() {
            map.off("click", layerId, handleClick);
            map.off("mouseenter", layerId, handleMouseEnter);
            map.off("mouseleave", layerId, handleMouseLeave);
            if (map.getLayer(layerId))
                map.removeLayer(layerId);
            map.removeSource(sourceId);
            if (hexHandle) {
                if (map.getLayer(hexHandle.hexLayerId))
                    map.removeLayer(hexHandle.hexLayerId);
                map.removeSource(hexHandle.hexSourceId);
            }
        },
    };
}
/** Re-renders a layer already added via renderTopicLayer with updated feature data, in place. */
export function updateTopicLayer(map, layerConfig, handle) {
    map.getSource(handle.sourceId)?.setData(featuresToFeatureCollection(layerConfig));
    if (handle.hexSourceId) {
        map.getSource(handle.hexSourceId)?.setData(featuresToHexCellCollection(layerConfig));
    }
}
