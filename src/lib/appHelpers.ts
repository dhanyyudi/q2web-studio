import bbox from "@turf/bbox";
import type { Geometry } from "geojson";
import type { DrawMode, LayerManifest } from "../types/project";

export type GeometryKind = "point" | "line" | "polygon" | "unknown";

export function layerHasMultiGeometry(layer: LayerManifest): boolean {
  return layer.geometryType.includes("Multi") || layer.geojson.features.some((feature) => feature.geometry?.type.startsWith("Multi"));
}

export function popupHtmlFromLayer(layer: LayerManifest): string {
  const rows = layer.popupFields
    .filter((field) => field.visible)
    .map((field) => field.header
      ? `<tr><td colspan="2"><strong>${field.label}</strong><br>{{${field.key}}}</td></tr>`
      : `<tr><th scope="row">${field.label}</th><td>{{${field.key}}}</td></tr>`)
    .join("");
  return `<table>${rows}</table>`;
}

export function geometryKindOf(geometryType: string): GeometryKind {
  if (geometryType.includes("Point")) return "point";
  if (geometryType.includes("Line")) return "line";
  if (geometryType.includes("Polygon")) return "polygon";
  return "unknown";
}

export function isDrawModeAllowed(drawMode: DrawMode, geometryKind: GeometryKind): boolean {
  if (drawMode === "point") return geometryKind === "point";
  if (drawMode === "linestring") return geometryKind === "line";
  if (drawMode === "polygon" || drawMode === "rectangle" || drawMode === "circle") {
    return geometryKind === "polygon";
  }
  return true;
}

export function shortcutRows(geometryKind: GeometryKind, canEditGeometry: boolean): { keycap: string; label: string }[] {
  const unavailable = canEditGeometry ? "Unavailable for selected layer" : "Multi-geometry layer is preview-only";
  return [
    { keycap: "1", label: canEditGeometry ? "Select and edit" : unavailable },
    { keycap: "2", label: canEditGeometry && geometryKind === "point" ? "Draw point" : unavailable },
    { keycap: "3", label: canEditGeometry && geometryKind === "line" ? "Draw line" : unavailable },
    { keycap: "4", label: canEditGeometry && geometryKind === "polygon" ? "Draw polygon" : unavailable },
    { keycap: "5", label: canEditGeometry && geometryKind === "polygon" ? "Draw rectangle" : unavailable },
    { keycap: "6", label: canEditGeometry && geometryKind === "polygon" ? "Draw circle" : unavailable },
    { keycap: "7", label: canEditGeometry ? "Lasso select" : unavailable },
    { keycap: "?", label: "Open this shortcuts dialog" },
    { keycap: "Esc", label: "Close shortcuts dialog" },
    { keycap: "Cmd/Ctrl+Z", label: "Undo project edit" },
    { keycap: "Cmd/Ctrl+Shift+Z", label: "Redo project edit" }
  ];
}

export function representativePoint(geometry: Geometry | null | undefined): GeoJSON.Feature<GeoJSON.Point> | null {
  if (!geometry) return null;
  if (geometry.type === "Point") return { type: "Feature", properties: {}, geometry };
  const box = bbox({ type: "Feature", properties: {}, geometry });
  if (box.some((value) => !Number.isFinite(value))) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
    }
  };
}
