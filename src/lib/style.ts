import type { Feature } from "geojson";
import type { PathOptions } from "leaflet";
import type { LayerManifest, LegendItem } from "../types/project";

export function styleForFeature(layer: LayerManifest, feature?: Feature): PathOptions {
  const categoryValue = layer.style.categoryField
    ? String(feature?.properties?.[layer.style.categoryField] ?? "")
    : "";
  const category = layer.style.categories.find((item) => item.value === categoryValue && item.visible);
  const fillColor = category?.fillColor || layer.style.fillColor;
  const strokeColor = category?.strokeColor || layer.style.strokeColor;

  return {
    color: strokeColor,
    fillColor,
    fillOpacity: layer.style.fillOpacity,
    opacity: layer.style.strokeOpacity,
    weight: category?.strokeWidth || layer.style.strokeWidth,
    dashArray: category?.dashArray || layer.style.dashArray || undefined
  };
}

export function legendItemsForLayer(layer: LayerManifest): LegendItem[] {
  if (!layer.legendEnabled) {
    return [];
  }
  if (layer.style.categories.length > 0) {
    return layer.style.categories
      .filter((item) => item.visible)
      .map((item) => ({
        id: `${layer.id}:${item.value}`,
        label: item.label || item.value,
        fillColor: item.fillColor,
        strokeColor: item.strokeColor,
        strokeWidth: item.strokeWidth,
        dashArray: item.dashArray,
        symbolType: item.symbolType,
        sourceImagePath: item.sourceImagePath,
        layerId: layer.id,
        visible: true
      }));
  }
  return [
    {
      id: `${layer.id}:default`,
      label: layer.displayName,
      fillColor: layer.style.fillColor,
      strokeColor: layer.style.strokeColor,
      strokeWidth: layer.style.strokeWidth,
      dashArray: layer.style.dashArray,
      symbolType: layer.style.symbolType,
      sourceImagePath: layer.style.sourceImagePath,
      layerId: layer.id,
      visible: true
    }
  ];
}

export function allLegendItems(layers: LayerManifest[], manual: LegendItem[]): LegendItem[] {
  return [...layers.flatMap(legendItemsForLayer), ...manual.filter((item) => item.visible)];
}

export function fieldNames(layer: LayerManifest): string[] {
  const keys = new Set<string>();
  layer.geojson.features.forEach((feature) => {
    Object.keys(feature.properties || {}).forEach((key) => {
      if (!key.startsWith("__q2ws_")) {
        keys.add(key);
      }
    });
  });
  return Array.from(keys);
}
