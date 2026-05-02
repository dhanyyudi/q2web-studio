import type { LayerControlSettings } from "../types/project";

export type NormalizedLayerControlStyle = {
  mode: LayerControlSettings["mode"];
  position: LayerControlSettings["position"];
  backgroundColor: string;
  backgroundOpacity: number;
  textColor: string;
  textSize: number;
  borderRadius: number;
};

const validModes: LayerControlSettings["mode"][] = ["collapsed", "expanded", "tree"];
const validPositions: LayerControlSettings["position"][] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export function normalizeLayerControlSettings(settings?: Partial<LayerControlSettings> | null): NormalizedLayerControlStyle {
  const rawMode = settings?.mode as string | undefined;
  const mode = rawMode === "compact" ? "collapsed" : rawMode;
  const position = settings?.position;
  return {
    mode: validModes.includes(mode as LayerControlSettings["mode"]) ? (mode as LayerControlSettings["mode"]) : "collapsed",
    position: validPositions.includes(position as LayerControlSettings["position"]) ? (position as LayerControlSettings["position"]) : "top-right",
    backgroundColor: normalizeHexColor(settings?.backgroundColor, "#ffffff"),
    backgroundOpacity: clampNumber(settings?.backgroundOpacity, 0, 100, 92),
    textColor: normalizeHexColor(settings?.textColor, "#172026"),
    textSize: clampNumber(settings?.textSize, 10, 18, 13),
    borderRadius: clampNumber(settings?.borderRadius, 0, 28, 12)
  };
}

export function layerControlPositionClass(position: LayerControlSettings["position"]): string {
  return `layer-toggle-${position}`;
}

export function runtimeLayerControlPositionClass(position: LayerControlSettings["position"]): string {
  return `q2ws-layer-control-${position}`;
}

export function alphaColor(color: string, opacityPercent: number): string {
  const hex = normalizeHexColor(color, "#ffffff").slice(1);
  const alpha = clampNumber(opacityPercent, 0, 100, 100) / 100;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}
