import type { Feature } from "geojson";
import type { GraduatedMethod, GraduatedRange, GraduatedStyle, LayerManifest, LayerStyle, LayerStyleMode } from "../types/project";

export function effectiveLayerStyleMode(layer: LayerManifest): LayerStyleMode {
  return normalizeLayerStyleMode(layer.style);
}

export function normalizeLayerStyleMode(style?: Partial<LayerStyle> | null): LayerStyleMode {
  if (style?.mode === "graduated") return "graduated";
  if (style?.mode === "categorized") return "categorized";
  if (style?.categoryField && (style.categories || []).length > 0) return "categorized";
  return "single";
}

export function normalizeGraduatedStyle(value?: Partial<GraduatedStyle> | null): GraduatedStyle {
  return {
    field: typeof value?.field === "string" ? value.field : "",
    method: normalizeGraduatedMethod(value?.method),
    classCount: Math.round(clampNumber(value?.classCount, 2, 7, 5)),
    ranges: Array.isArray(value?.ranges) ? value.ranges.map(normalizeGraduatedRange) : []
  };
}

export function numericFieldNames(layer: LayerManifest): string[] {
  const stats = new Map<string, { numericCount: number; invalidCount: number }>();
  layer.geojson.features.forEach((feature) => {
    Object.entries(feature.properties || {}).forEach(([key, value]) => {
      if (key.startsWith("__q2ws_")) return;
      const fieldStats = stats.get(key) || { numericCount: 0, invalidCount: 0 };
      if (isEmptyValue(value)) {
        stats.set(key, fieldStats);
        return;
      }
      if (numericLike(value)) {
        fieldStats.numericCount += 1;
      } else {
        fieldStats.invalidCount += 1;
      }
      stats.set(key, fieldStats);
    });
  });
  return Array.from(stats.entries())
    .filter(([, value]) => value.numericCount > 0 && value.invalidCount === 0)
    .map(([key]) => key);
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function numericValue(feature: Feature, field: string): number | null {
  const value = feature.properties?.[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function numericLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

function normalizeGraduatedMethod(value: unknown): GraduatedMethod {
  return value === "quantile" || value === "manual" ? value : "equal";
}

function normalizeGraduatedRange(value: Partial<GraduatedRange>): GraduatedRange {
  return {
    min: Number.isFinite(Number(value.min)) ? Number(value.min) : 0,
    max: Number.isFinite(Number(value.max)) ? Number(value.max) : 0,
    label: typeof value.label === "string" ? value.label : "",
    fillColor: typeof value.fillColor === "string" ? value.fillColor : "#3388ff",
    strokeColor: typeof value.strokeColor === "string" ? value.strokeColor : "#1f2937",
    strokeWidth: clampNumber(value.strokeWidth, 0, 20, 2),
    dashArray: typeof value.dashArray === "string" ? value.dashArray : "",
    visible: value.visible !== false
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}
