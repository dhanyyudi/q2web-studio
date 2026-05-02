import length from "@turf/length";
import type { Feature, LineString, MultiLineString, MultiPolygon, Point, Polygon } from "geojson";
import type { Geometry } from "geojson";
import type { LayerManifest, Qgis2webProject } from "../types/project";

export function isSimpleEditableGeometry(geometry: Geometry): geometry is Point | LineString | Polygon {
  return geometry.type === "Point" || geometry.type === "LineString" || geometry.type === "Polygon";
}

export function translateGeometry<T extends Point | LineString | Polygon>(geometry: T, dx: number, dy: number): T {
  if (geometry.type === "Point") return { ...geometry, coordinates: translateCoordinate(geometry.coordinates, dx, dy) } as T;
  if (geometry.type === "LineString") return { ...geometry, coordinates: geometry.coordinates.map((coordinate) => translateCoordinate(coordinate, dx, dy)) } as T;
  return { ...geometry, coordinates: geometry.coordinates.map((ring) => ring.map((coordinate) => translateCoordinate(coordinate, dx, dy))) } as T;
}

function translateCoordinate(coordinate: GeoJSON.Position, dx: number, dy: number): GeoJSON.Position {
  return [coordinate[0] + dx, coordinate[1] + dy, ...coordinate.slice(2)];
}

export function rotateGeometry<T extends Point | LineString | Polygon>(geometry: T, angleDegrees: number): T {
  const center = geometryCenter(geometry);
  if (!center) return geometry;
  if (geometry.type === "Point") return { ...geometry, coordinates: rotateCoordinate(geometry.coordinates, center, angleDegrees) } as T;
  if (geometry.type === "LineString") return { ...geometry, coordinates: geometry.coordinates.map((coordinate) => rotateCoordinate(coordinate, center, angleDegrees)) } as T;
  return { ...geometry, coordinates: geometry.coordinates.map((ring) => ring.map((coordinate) => rotateCoordinate(coordinate, center, angleDegrees))) } as T;
}

function geometryCenter(geometry: Point | LineString | Polygon): GeoJSON.Position | null {
  if (geometry.type === "Point") return geometry.coordinates;
  const pairs = geometry.type === "LineString" ? geometry.coordinates : geometry.coordinates.flat();
  if (pairs.length === 0) return null;
  const lngs = pairs.map((coordinate) => coordinate[0]);
  const lats = pairs.map((coordinate) => coordinate[1]);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

function rotateCoordinate(coordinate: GeoJSON.Position, center: GeoJSON.Position, angleDegrees: number): GeoJSON.Position {
  const radians = angleDegrees * (Math.PI / 180);
  const dx = coordinate[0] - center[0];
  const dy = coordinate[1] - center[1];
  const x = dx * Math.cos(radians) - dy * Math.sin(radians);
  const y = dx * Math.sin(radians) + dy * Math.cos(radians);
  return [roundCoordinate(center[0] + x), roundCoordinate(center[1] + y), ...coordinate.slice(2)];
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function scaleGeometry<T extends Point | LineString | Polygon>(geometry: T, factor: number): T {
  const center = geometryCenter(geometry);
  if (!center) return geometry;
  if (geometry.type === "Point") return { ...geometry, coordinates: scaleCoordinate(geometry.coordinates, center, factor) } as T;
  if (geometry.type === "LineString") return { ...geometry, coordinates: geometry.coordinates.map((coordinate) => scaleCoordinate(coordinate, center, factor)) } as T;
  return { ...geometry, coordinates: geometry.coordinates.map((ring) => ring.map((coordinate) => scaleCoordinate(coordinate, center, factor))) } as T;
}

function scaleCoordinate(coordinate: GeoJSON.Position, center: GeoJSON.Position, factor: number): GeoJSON.Position {
  const dx = coordinate[0] - center[0];
  const dy = coordinate[1] - center[1];
  return [roundCoordinate(center[0] + dx * factor), roundCoordinate(center[1] + dy * factor), ...coordinate.slice(2)];
}

export function buildLineOperationLayer(
  project: Qgis2webProject,
  layer: LayerManifest,
  layerId: string,
  displayName: string,
  sourceFeatureId: string,
  operation: string,
  segments: LineString[],
  stylePatch: Partial<LayerManifest["style"]>
): LayerManifest {
  return {
    ...layer,
    id: layerId,
    displayName,
    sourcePath: `${project.name}/data/${layerId}.js`,
    dataVariable: `json_${layerId}`,
    layerVariable: `layer_${layerId}`,
    geometryType: "LineString",
    visible: true,
    showInLayerControl: true,
    popupEnabled: true,
    legendEnabled: true,
    layerTreeGroup: "Analysis",
    label: undefined,
    popupFields: [
      { key: "source_layer", label: "source_layer", visible: true, header: false },
      { key: "source_feature", label: "source_feature", visible: true, header: false },
      { key: "operation", label: "operation", visible: true, header: false },
      { key: "segment_index", label: "segment_index", visible: true, header: false }
    ],
    popupTemplate: undefined,
    geojson: {
      type: "FeatureCollection",
      features: segments.map((segment, index) => ({
        type: "Feature" as const,
        id: `${layerId}::${sourceFeatureId}::${index}`,
        geometry: segment,
        properties: {
          __q2ws_id: `${layerId}::${sourceFeatureId}::${index}`,
          source_layer: layer.displayName,
          source_feature: sourceFeatureId,
          operation,
          segment_index: index + 1
        }
      }))
    },
    style: {
      ...layer.style,
      fillColor: stylePatch.fillColor ?? layer.style.fillColor,
      strokeColor: stylePatch.strokeColor ?? layer.style.strokeColor,
      fillOpacity: stylePatch.fillOpacity ?? layer.style.fillOpacity,
      strokeOpacity: stylePatch.strokeOpacity ?? layer.style.strokeOpacity,
      strokeWidth: stylePatch.strokeWidth ?? layer.style.strokeWidth,
      dashArray: stylePatch.dashArray ?? layer.style.dashArray,
      symbolType: "line"
    }
  };
}

export function splitLinePartAtMidpoint(coordinates: Array<[number, number]>): LineString[] {
  return divideLinePart(coordinates, 2);
}

export function divideLinePart(coordinates: Array<[number, number]>, parts: number): LineString[] {
  if (coordinates.length < 2 || parts < 1) return [];
  const partFeature: Feature<LineString> = { type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} };
  const totalLength = length(partFeature, { units: "kilometers" });
  if (totalLength === 0) return [];
  const cumulativeDistances = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    const segmentFeature: Feature<LineString> = { type: "Feature", geometry: { type: "LineString", coordinates: [coordinates[index - 1], coordinates[index]] }, properties: {} };
    cumulativeDistances.push(cumulativeDistances[index - 1] + length(segmentFeature, { units: "kilometers" }));
  }
  const targets = Array.from({ length: parts + 1 }, (_, index) => totalLength * (index / parts));
  const splitPoints = targets.map((targetDistance) => interpolatePointOnLine(coordinates, cumulativeDistances, targetDistance));
  const segments: LineString[] = [];
  for (let index = 0; index < parts; index += 1) {
    const start = splitPoints[index];
    const end = splitPoints[index + 1];
    const segmentCoordinates: Array<[number, number]> = [start.coordinate];
    for (let vertexIndex = start.segmentIndex + 1; vertexIndex <= end.segmentIndex; vertexIndex += 1) {
      const vertex = coordinates[vertexIndex];
      if (!pointsEqual(vertex, segmentCoordinates[segmentCoordinates.length - 1])) segmentCoordinates.push(vertex);
    }
    if (!pointsEqual(end.coordinate, segmentCoordinates[segmentCoordinates.length - 1])) segmentCoordinates.push(end.coordinate);
    if (segmentCoordinates.length >= 2) segments.push({ type: "LineString", coordinates: segmentCoordinates });
  }
  return segments;
}

function interpolatePointOnLine(coordinates: Array<[number, number]>, cumulativeDistances: number[], targetDistance: number): { coordinate: [number, number]; segmentIndex: number } {
  if (targetDistance <= 0) return { coordinate: coordinates[0], segmentIndex: 0 };
  const lastIndex = coordinates.length - 1;
  const totalLength = cumulativeDistances[lastIndex];
  if (targetDistance >= totalLength) return { coordinate: coordinates[lastIndex], segmentIndex: lastIndex - 1 };
  for (let index = 0; index < lastIndex; index += 1) {
    const segmentStart = cumulativeDistances[index];
    const segmentEnd = cumulativeDistances[index + 1];
    if (targetDistance > segmentEnd) continue;
    const segmentLength = segmentEnd - segmentStart;
    if (segmentLength === 0) return { coordinate: coordinates[index + 1], segmentIndex: index };
    const ratio = (targetDistance - segmentStart) / segmentLength;
    const [startX, startY] = coordinates[index];
    const [endX, endY] = coordinates[index + 1];
    return { coordinate: [startX + ((endX - startX) * ratio), startY + ((endY - startY) * ratio)], segmentIndex: index };
  }
  return { coordinate: coordinates[lastIndex], segmentIndex: lastIndex - 1 };
}

function pointsEqual(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
