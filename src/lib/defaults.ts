import type { BrandingSettings, LayerStyle, MapSettings, Qgis2webProject, ThemeSettings } from "../types/project";

export const defaultTheme: ThemeSettings = {
  accent: "#156f7a",
  surface: "#ffffff",
  text: "#172026",
  muted: "#66737f",
  radius: 8,
  shadow: 18,
  fontFamily: "Inter, Segoe UI, Arial, sans-serif",
  headerHeight: 48
};

export const defaultBranding: BrandingSettings = {
  title: "Peta WebGIS Interaktif",
  subtitle: "Dibuat dari export qgis2web",
  footer: "Dibuat dengan QGIS, qgis2web, dan qgis2web Studio",
  showHeader: true,
  showFooter: true,
  showWelcome: false,
  showSidebar: true,
  logoPath: "",
  logoPlacement: "left"
};

export const defaultMapSettings: MapSettings = {
  basemap: "carto-voyager",
  viewMode: "all"
};

export const emptyProject: Qgis2webProject | null = null;

export function defaultLayerStyle(geometryType: string, index: number): LayerStyle {
  const palette = ["#f59e0b", "#0ea5e9", "#22c55e", "#ef4444", "#8b5cf6", "#14b8a6"];
  const color = palette[index % palette.length];
  const isLine = geometryType.includes("Line");
  const isPoint = geometryType.includes("Point");

  return {
    fillColor: isLine ? "transparent" : color,
    strokeColor: color,
    fillOpacity: isPoint ? 0.85 : 0.55,
    strokeOpacity: 0.95,
    strokeWidth: isLine ? 3 : 1.4,
    dashArray: "",
    pointRadius: 6,
    textColor: "#172026",
    textSize: 13,
    symbolType: isLine ? "line" : isPoint ? "point" : "polygon",
    sourceImagePath: "",
    categoryField: "",
    categories: []
  };
}
