import type {
  BasemapConfig,
  BrandingSettings,
  LayerStyle,
  LegendSettings,
  MapSettings,
  PopupSettings,
  Qgis2webProject,
  RuntimeSettings,
  ThemeSettings
} from "../types/project";

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
  headerPlacement: "top-full",
  footerPlacement: "bottom-full",
  welcome: {
    enabled: false,
    title: "Selamat datang",
    subtitle: "Jelajahi peta interaktif ini.",
    ctaLabel: "Mulai jelajah",
    autoDismiss: "never",
    showOnce: false,
    placement: "center"
  },
  logoPath: "",
  logoPlacement: "left"
};

export const defaultMapSettings: MapSettings = {
  basemap: "carto-voyager",
  viewMode: "all",
  initialZoomMode: "fit",
  initialZoom: 13,
  layerControlMode: "original"
};

export const defaultBasemaps: BasemapConfig[] = [
  {
    id: "carto-voyager",
    label: "Carto Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
    default: true,
    enabled: true,
    source: "studio"
  },
  {
    id: "esri-imagery",
    label: "Esri World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 20,
    default: false,
    enabled: true,
    source: "studio"
  },
  {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "OpenStreetMap",
    maxZoom: 19,
    default: false,
    enabled: true,
    source: "studio"
  }
];

export const defaultRuntimeSettings: RuntimeSettings = {
  widgets: []
};

export const defaultLegendSettings: LegendSettings = {
  enabled: false,
  position: "bottom-right",
  placement: "hidden",
  collapsed: false,
  groupByLayer: true
};

export const defaultPopupSettings: PopupSettings = {
  style: "card",
  accentColor: "#156f7a",
  backgroundColor: "#ffffff",
  textColor: "#172026",
  labelColor: "#4b5b66",
  radius: 10,
  shadow: 22
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
