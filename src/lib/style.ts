import type { Feature } from "geojson";
import type { PathOptions } from "leaflet";
import type { LayerManifest, LegendItem } from "../types/project";
import { effectiveLayerStyleMode } from "./styleMode";

export type LegendGroup = {
  id: string;
  label: string;
  items: LegendItem[];
};

function normalizeCategoryValue(value: unknown): string {
  return value == null ? "" : String(value);
}

export function styleForFeature(layer: LayerManifest, feature?: Feature): PathOptions {
  const mode = effectiveLayerStyleMode(layer);
  const categoryValue = mode === "categorized" && layer.style.categoryField
    ? normalizeCategoryValue(feature?.properties?.[layer.style.categoryField])
    : "";
  const category = mode === "categorized" ? layer.style.categories.find((item) => item.value === categoryValue && item.visible) : undefined;
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
  if (effectiveLayerStyleMode(layer) === "categorized" && layer.style.categories.length > 0) {
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

export function legendGroupsForLayers(layers: LayerManifest[], manual: LegendItem[]): LegendGroup[] {
  const groups = layers
    .filter((layer) => layer.visible && layer.legendEnabled)
    .map((layer) => ({
      id: layer.id,
      label: layer.displayName,
      items: legendItemsForLayer(layer)
    }))
    .filter((group) => group.items.length > 0);
  const manualItems = manual.filter((item) => item.visible);
  if (manualItems.length > 0) {
    groups.push({
      id: "manual",
      label: "Manual legend",
      items: manualItems
    });
  }
  return groups;
}

const CATEGORY_PALETTE = ["#f59e0b", "#0ea5e9", "#22c55e", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"];

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

export function categoriesForField(layer: LayerManifest, field: string): LayerManifest["style"]["categories"] {
  if (!field) return [];

  const existingByValue = new Map(layer.style.categories.map((category) => [category.value, category]));
  const legacyEmptyCategory = existingByValue.get("(empty)");
  const values = new Set<string>();
  layer.geojson.features.forEach((feature) => {
    values.add(normalizeCategoryValue(feature.properties?.[field]));
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b)).map((value, index) => {
    const existing = existingByValue.get(value) || (value === "" ? legacyEmptyCategory : undefined);
    const color = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
    return {
      value,
      label: existing?.label || (value === "" ? "(empty)" : value),
      fillColor: existing?.fillColor || (layer.style.fillColor === "transparent" ? color : color),
      strokeColor: existing?.strokeColor || layer.style.strokeColor || color,
      strokeWidth: existing?.strokeWidth || layer.style.strokeWidth,
      dashArray: existing?.dashArray ?? layer.style.dashArray,
      symbolType: existing?.symbolType || layer.style.symbolType,
      sourceImagePath: existing?.sourceImagePath || layer.style.sourceImagePath,
      visible: existing?.visible ?? true
    };
  });
}
