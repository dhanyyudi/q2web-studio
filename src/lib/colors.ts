export function rgbaToHex(input: string, fallback = "#3388ff"): string {
  const rgba = input.match(/rgba?\(([^)]+)\)/i);
  if (!rgba) {
    return input.startsWith("#") ? input : fallback;
  }
  const channels = rgba[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (channels.length < 3 || channels.some((value) => Number.isNaN(value))) {
    return fallback;
  }
  return `#${channels
    .slice(0, 3)
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function opacityFromRgba(input: string, fallback = 1): number {
  const rgba = input.match(/rgba\(([^)]+)\)/i);
  if (!rgba) {
    return fallback;
  }
  const channels = rgba[1].split(",").map((part) => Number.parseFloat(part.trim()));
  return Number.isFinite(channels[3]) ? channels[3] : fallback;
}

export function hexToRgba(hex: string, opacity = 1): string {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r || 0}, ${g || 0}, ${b || 0}, ${opacity})`;
}
