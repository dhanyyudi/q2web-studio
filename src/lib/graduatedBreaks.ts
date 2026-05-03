import type { LayerManifest, GraduatedMethod, GraduatedRange } from "../types/project";
import { numericValue } from "./styleMode";

const GRADUATED_PALETTE = ["#eff6ff", "#bfdbfe", "#93c5fd", "#60a5fa", "#2563eb", "#1d4ed8", "#1e3a8a"];

export function buildGraduatedRanges(
  layer: LayerManifest,
  field: string,
  method: GraduatedMethod,
  classCount: number
): GraduatedRange[] {
  if (!field) return [];

  const safeClassCount = clampGraduatedClassCount(classCount);
  const values = layer.geojson.features
    .map((feature) => numericValue(feature, field))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  if (values.length === 0) return [];

  const breaks = method === "quantile"
    ? buildQuantileBreaks(values, safeClassCount)
    : buildEqualBreaks(values, safeClassCount);

  return breaks.map(([min, max], index) => {
    const color = GRADUATED_PALETTE[Math.min(index, GRADUATED_PALETTE.length - 1)];
    return {
      min,
      max,
      label: `Class ${index + 1}`,
      fillColor: layer.style.fillColor === "transparent" ? color : color,
      strokeColor: layer.style.strokeColor,
      strokeWidth: layer.style.strokeWidth,
      dashArray: layer.style.dashArray,
      visible: true
    };
  });
}

function buildEqualBreaks(values: number[], classCount: number): Array<[number, number]> {
  const min = values[0];
  const max = values[values.length - 1];
  if (min === max) return [[min, max]];

  const step = (max - min) / classCount;
  return Array.from({ length: classCount }, (_, index) => {
    const rangeMin = roundRangeValue(min + (step * index));
    const rangeMax = index === classCount - 1 ? max : roundRangeValue(min + (step * (index + 1)));
    return [rangeMin, rangeMax];
  });
}

function buildQuantileBreaks(values: number[], classCount: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < classCount; index += 1) {
    const startIndex = Math.floor((index * values.length) / classCount);
    const endIndex = Math.min(values.length - 1, Math.floor((((index + 1) * values.length) / classCount) - 1));
    const min = values[startIndex];
    const max = values[Math.max(startIndex, endIndex)];
    ranges.push([min, max]);
  }
  return mergeDuplicateRanges(ranges);
}

function mergeDuplicateRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  return ranges.filter((range, index) => index === 0 || range[0] !== ranges[index - 1][0] || range[1] !== ranges[index - 1][1]);
}

function roundRangeValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"));
}

function clampGraduatedClassCount(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.min(7, Math.max(2, Math.round(value)));
}

