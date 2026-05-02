export type DashArrayPresetKey =
  | "solid"
  | "dotted"
  | "dashed-short"
  | "dashed-long"
  | "dash-dot"
  | "dash-dot-dot"
  | "custom";

export type DashArrayPreset = {
  key: DashArrayPresetKey;
  label: string;
  value: string;
};

export const DASH_ARRAY_PRESETS: DashArrayPreset[] = [
  { key: "solid", label: "Solid", value: "" },
  { key: "dotted", label: "Dotted", value: "2 4" },
  { key: "dashed-short", label: "Dashed short", value: "6 4" },
  { key: "dashed-long", label: "Dashed long", value: "12 6" },
  { key: "dash-dot", label: "Dash-dot", value: "10 4 2 4" },
  { key: "dash-dot-dot", label: "Dash-dot-dot", value: "10 4 2 4 2 4" },
  { key: "custom", label: "Custom", value: "" }
];

export function normalizeDashArray(input: string | null | undefined): string {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isValidDashArray(input: string | null | undefined): boolean {
  const normalized = normalizeDashArray(input);
  if (!normalized) return true;
  if (!/^\d*\.?\d+(?:\s+\d*\.?\d+)*$/.test(normalized)) return false;
  const parts = normalized.split(" ").map(Number);
  return parts.length > 0 && parts.every((value) => Number.isFinite(value) && value > 0);
}

export function getDashArrayPresetKey(input: string | null | undefined): DashArrayPresetKey {
  const normalized = normalizeDashArray(input);
  const preset = DASH_ARRAY_PRESETS.find(
    (candidate) => candidate.key !== "custom" && candidate.value === normalized
  );
  return preset?.key || "custom";
}
