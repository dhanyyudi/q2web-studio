import L from "leaflet";
import bbox from "@turf/bbox";
import type { Feature, FeatureCollection } from "geojson";
import type { TerraDraw } from "terra-draw";
import type { GeoJSONStoreFeatures } from "terra-draw";
import { styleForFeature } from "../lib/style";
import type { BasemapConfig, LayerManifest, Qgis2webProject } from "../types/project";

export function createBasemap(basemaps: BasemapConfig[], activeBasemapId: string): L.TileLayer | null {
  if (activeBasemapId === "none") return null;
  const enabledBasemaps = basemaps.filter((item) => item.enabled !== false);
  const basemap = enabledBasemaps.find((item) => item.id === activeBasemapId) || enabledBasemaps.find((item) => item.default) || enabledBasemaps[0];
  if (!basemap?.url) return null;
  return L.tileLayer(basemap.url, {
    attribution: basemap.attribution,
    maxZoom: basemap.maxZoom
  });
}

export function visiblePreviewLayers(layers: LayerManifest[], selectedLayerId: string, viewMode: string): LayerManifest[] {
  if (viewMode === "selected") {
    return layers.filter((layer) => layer.id === selectedLayerId);
  }
  return layers;
}

export function shouldClusterLayer(layer: LayerManifest): boolean {
  return layer.geometryType.includes("Point") && layer.geojson.features.length > 500;
}

export function pointClusterIcon(layer: LayerManifest, feature: Feature): L.DivIcon {
  const style = styleForFeature(layer, feature);
  const radius = Math.max(7, layer.style.pointRadius);
  const size = radius * 2 + 4;
  const fill = String(style.fillColor || style.color || layer.style.fillColor);
  const stroke = String(style.color || layer.style.strokeColor);
  const opacity = Number(style.fillOpacity ?? layer.style.fillOpacity);
  const weight = Number(style.weight ?? layer.style.strokeWidth);
  return L.divIcon({
    className: "studio-point-marker",
    html: `<span style="width:${size}px;height:${size}px;background:${fill};border:${Math.max(1, weight)}px solid ${stroke};opacity:${Number.isFinite(opacity) ? opacity : 1}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

export function buildLabel(layer: LayerManifest, feature: Feature): string {
  const label = layer.label;
  const value = feature.properties?.[label?.field || ""] ?? "";
  if (label?.htmlTemplate) {
    return sanitizeLabelHtml(label.htmlTemplate.replace(/\{\{\s*([A-Za-z0-9_:-]+)\s*\}\}/g, (_match, key: string) => escapeHtml(feature.properties?.[key] ?? "")));
  }
  return escapeHtml(value);
}

export function labelCss(layers: LayerManifest[]): string {
  return layers
    .filter((layer) => layer.label?.className && layer.label.cssText)
    .map((layer) => `.${layer.label!.className} { ${layer.label!.cssText} }`)
    .join("\n");
}

export function buildPopup(layer: LayerManifest, feature: Feature): string {
  if (layer.popupTemplate?.mode === "original" || layer.popupTemplate?.mode === "custom") {
    return renderPopupTemplate(layer.popupTemplate.html, feature);
  }
  const rows = layer.popupFields
    .filter((field) => field.visible)
    .map((field) => {
      const value = feature.properties?.[field.key] ?? "";
      return field.header
        ? `<tr><td colspan="2"><strong>${escapeHtml(field.label)}</strong><br>${escapeHtml(value)}</td></tr>`
        : `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(value)}</td></tr>`;
    })
    .join("");
  return `<table class="studio-popup">${rows}</table>`;
}

export function popupCss(project: Qgis2webProject): string {
  const popup = project.popupSettings;
  const border = popup.style === "minimal" ? "0" : `1px solid ${popup.accentColor}`;
  const headerBg = popup.style === "compact" ? "transparent" : colorMix(popup.accentColor, "#ffffff", 0.09);
  const base = `
    .leaflet-popup-content-wrapper {
      border: ${border};
      border-radius: ${popup.radius}px;
      background: ${popup.backgroundColor};
      color: ${popup.textColor};
      box-shadow: 0 ${Math.max(6, popup.shadow / 2)}px ${Math.max(14, popup.shadow)}px rgba(0, 0, 0, 0.22);
    }
    .leaflet-popup-tip {
      background: ${popup.backgroundColor};
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.16);
    }
    .leaflet-popup-content {
      max-width: min(360px, 72vw);
      margin: 12px 14px;
      overflow-wrap: anywhere;
      line-height: 1.42;
    }
    .studio-popup {
      width: 100%;
      min-width: 220px;
      max-width: 340px;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
      font: 12px Inter, Segoe UI, Arial, sans-serif;
    }
    .studio-popup th,
    .studio-popup td {
      border: 1px solid rgba(82, 103, 113, 0.14);
      padding: ${popup.style === "compact" ? "5px 7px" : "7px 9px"};
      vertical-align: top;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.36;
    }
    .studio-popup th {
      width: 38%;
      background: ${headerBg};
      color: ${popup.labelColor};
      font-weight: 750;
      text-align: left;
    }
    .studio-popup strong {
      color: ${popup.accentColor};
    }
  `;
  const layerOverrides = project.layers
    .filter((layer) => layer.popupSettings)
    .map((layer) => {
      const override = layer.popupSettings!;
      return `.popup-layer-${layer.id} .leaflet-popup-content-wrapper { border-color: ${override.accentColor}; border-radius: ${override.radius}px; background: ${override.backgroundColor}; color: ${override.textColor}; box-shadow: 0 ${Math.max(6, override.shadow / 2)}px ${Math.max(14, override.shadow)}px rgba(0, 0, 0, 0.22); }
.popup-layer-${layer.id} .leaflet-popup-tip { background: ${override.backgroundColor}; }
.popup-layer-${layer.id} .studio-popup th { color: ${override.labelColor}; }
.popup-layer-${layer.id} .studio-popup strong { color: ${override.accentColor}; }`;
    })
    .join("\n");
  return base + layerOverrides;
}

export function projectBounds(layers: LayerManifest[]): L.LatLngBounds | null {
  const collections = layers.map((layer) => layer.geojson);
  if (collections.length === 0) return null;
  const box = bbox({
    type: "FeatureCollection",
    features: collections.flatMap((collection) => collection.features)
  } as FeatureCollection);
  if (box.some((value) => !Number.isFinite(value))) return null;
  return L.latLngBounds([box[1], box[0]], [box[3], box[2]]);
}

export function toTerraDrawFeatures(layer: LayerManifest): GeoJSONStoreFeatures[] {
  return layer.geojson.features
    .filter((feature) => ["Point", "LineString", "Polygon"].includes(feature.geometry?.type || ""))
    .map((feature, index) => ({
      ...feature,
      id: feature.id || `${layer.id}-edit-${index}`,
      properties: {
        ...(feature.properties || {}),
        mode: feature.geometry.type.toLowerCase() === "linestring" ? "linestring" : feature.geometry.type.toLowerCase()
      }
    })) as GeoJSONStoreFeatures[];
}

export function fromTerraDrawFeature(feature: ReturnType<TerraDraw["getSnapshot"]>[number]): Feature {
  const properties = { ...(feature.properties || {}) };
  delete properties.mode;
  return {
    type: "Feature",
    id: feature.id,
    properties,
    geometry: feature.geometry
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function renderPopupTemplate(template: string, feature: Feature): string {
  return sanitizePopupHtml(
    template.replace(/\{\{\s*([A-Za-z0-9_:-]+)\s*\}\}/g, (_match, key: string) => escapeHtml(feature.properties?.[key] ?? ""))
  );
}

function sanitizeLabelHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set(["DIV", "SPAN", "B", "I", "EM", "STRONG", "BR"]);
  const allowedAttrs = new Set(["class", "style"]);
  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }
    Array.from(element.attributes).forEach((attr) => {
      if (!allowedAttrs.has(attr.name.toLowerCase())) element.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

function sanitizePopupHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set(["TABLE", "TBODY", "THEAD", "TR", "TH", "TD", "STRONG", "BR", "SPAN", "DIV", "P", "B", "I", "EM"]);
  const allowedAttrs = new Set(["class", "id", "scope", "colspan", "rowspan"]);
  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }
    Array.from(element.attributes).forEach((attr) => {
      if (!allowedAttrs.has(attr.name.toLowerCase())) element.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

function colorMix(color: string, fallback: string, opacity: number): string {
  const hex = color.startsWith("#") ? color.slice(1) : "";
  if (![3, 6].includes(hex.length)) return fallback;
  const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return fallback;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
