import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Feature, LineString, MultiLineString, MultiPolygon, Point, Polygon as GeoJsonPolygon } from "geojson";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { buffer as turfBuffer } from "@turf/buffer";
import convex from "@turf/convex";
import { polygonToLine } from "@turf/polygon-to-line";
import simplify from "@turf/simplify";
import union from "@turf/union";
import { featureCollection } from "@turf/helpers";
import { saveProjectToOpfs } from "../lib/opfs";
import { geometryKindOf, layerHasMultiGeometry, popupHtmlFromLayer, representativePoint } from "../lib/appHelpers";
import {
  buildLineOperationLayer,
  divideLinePart,
  isSimpleEditableGeometry,
  rotateGeometry,
  scaleGeometry,
  splitLinePartAtMidpoint,
  translateGeometry
} from "../lib/geometryTransforms";
import { projectCenter } from "../lib/projectHydration";
import { isVectorLayer } from "../lib/rasterParsing";
import { addFeatureProperty, deleteFeatureProperty, renameField, updateFeatureProperty, updateVectorLayer, updateLayerGeojson } from "../lib/projectUpdates";
import { fieldNames } from "../lib/style";
import type {
  BasemapConfig,
  DrawMode,
  LayerManifest,
  Qgis2webProject,
  SelectedFeatureRef,
  TextAnnotation
} from "../types/project";

export type InspectorMode = "project" | "layer";
export type HistoryEntry = { project: Qgis2webProject; label: string; group?: string; updatedAt: number };
export type UpdateProjectOptions = { label?: string; group?: string; coalesceMs?: number };

const HISTORY_LIMIT = 30;
const DIVIDE_PARTS = 3;

export function useProjectState({
  hydrateProject
}: {
  hydrateProject: (project: Qgis2webProject) => Qgis2webProject;
}) {
  const [project, setProject] = useState<Qgis2webProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeatureRef | null>(null);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("project");
  const [drawMode, setDrawMode] = useState<DrawMode>("select");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [attributeFilter, setAttributeFilter] = useState("");
  const [status, setStatus] = useState("Import a qgis2web export to start editing.");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] });
  const [newFeaturePropertyKey, setNewFeaturePropertyKey] = useState("");
  const [newFeaturePropertyValue, setNewFeaturePropertyValue] = useState("");

  const selectedProjectLayer = useMemo(
    () => project?.layers.find((layer) => layer.id === selectedLayerId),
    [project, selectedLayerId]
  );

  const selectedLayer = useMemo(
    () => {
      if (!project) return undefined;
      const matched = project.layers.find((layer) => layer.id === selectedLayerId);
      if (matched && isVectorLayer(matched)) return matched;
      return project.layers.find(isVectorLayer);
    },
    [project, selectedLayerId]
  );

  const selectedFeatureData = useMemo(() => {
    if (!project || !selectedFeature) return null;
    const layer = project.layers.find((item) => item.id === selectedFeature.layerId);
    if (!layer || !isVectorLayer(layer)) return null;
    const feature = layer.geojson.features.find(
      (item) => String(item.properties?.__q2ws_id ?? item.id ?? "") === selectedFeature.featureId
    );
    if (!feature) return null;
    return { layer, feature };
  }, [project, selectedFeature]);

  function warnIfOpfsFallback(result: { warning?: string }) {
    if (result.warning) {
      toast.warning(result.warning, { duration: 9000 });
    }
  }

  function updateProject(next: Qgis2webProject, options: UpdateProjectOptions = {}) {
    const hydrated = hydrateProject(next);
    if (project) {
      setHistory((current) => ({
        past: pushHistoryEntry(current.past, {
          project,
          label: options.label || "Project change",
          group: options.group,
          updatedAt: Date.now()
        }, options.coalesceMs ?? 0),
        future: []
      }));
    }
    setProject(hydrated);
    void saveProjectToOpfs(hydrated).then(warnIfOpfsFallback).catch(() => undefined);
  }

  function restoreProject(next: Qgis2webProject) {
    const hydrated = hydrateProject(next);
    setProject(hydrated);
    setSelectedLayerId((current) => (hydrated.layers.some((layer) => layer.id === current) ? current : hydrated.layers[0]?.id || ""));
    void saveProjectToOpfs(hydrated).then(warnIfOpfsFallback).catch(() => undefined);
  }

  function undoProject() {
    if (!project) return;
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    restoreProject(previous.project);
    setHistory({
      past: history.past.slice(0, -1),
      future: [{ project, label: previous.label, group: previous.group, updatedAt: Date.now() }, ...history.future].slice(0, HISTORY_LIMIT)
    });
    toast.info(`Undid ${previous.label}`);
  }

  function redoProject() {
    if (!project) return;
    const next = history.future[0];
    if (!next) return;
    restoreProject(next.project);
    setHistory({
      past: pushHistoryEntry(history.past, { project, label: next.label, group: next.group, updatedAt: Date.now() }, 0),
      future: history.future.slice(1)
    });
    toast.info(`Redid ${next.label}`);
  }

  function warnAboutLargeDatasets(next: Qgis2webProject) {
    const heavyLayers = next.layers.filter(isVectorLayer).filter((layer) => layer.geojson.features.length > 10000);
    if (heavyLayers.length === 0) return;
    const biggest = heavyLayers
      .map((layer) => `${layer.displayName}: ${layer.geojson.features.length.toLocaleString()} features`)
      .join(", ");
    toast.warning(`Large dataset imported. Rendering may be slow. ${biggest}`, { duration: 9000 });
  }

  const handleTileError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const handleSelectedFeatureChange = useCallback((selection: SelectedFeatureRef | null) => {
    setSelectedFeature(selection);
    if (selection) setSelectedFeatureIds([]);
  }, []);

  function patchSelectedLayer(patch: Partial<LayerManifest>) {
    if (!project || !selectedLayer) return;
    updateProject(updateVectorLayer(project, selectedLayer.id, patch));
  }

  function updateRasterLayer(layerId: string, patch: Record<string, unknown>) {
    if (!project) return;
    updateProject({
      ...project,
      layers: project.layers.map((layer) => {
        if (layer.id !== layerId || isVectorLayer(layer)) return layer;
        return { ...layer, ...patch };
      })
    }, { label: "Edit raster layer", group: `raster-layer:${layerId}`, coalesceMs: 600 });
  }

  function selectedFeatureIdValue() {
    return String(selectedFeatureData?.feature.properties?.__q2ws_id ?? selectedFeatureData?.feature.id ?? "");
  }

  function selectedFeatureTitle(layer: LayerManifest, feature: GeoJSON.Feature) {
    const properties = feature.properties || {};
    const labelField = layer.label?.field || "";
    const preferredValue = labelField ? properties[labelField] : undefined;
    if (preferredValue != null && String(preferredValue).trim()) return String(preferredValue).trim();
    const nextProperty = Object.entries(properties).find(([key, value]) => key !== "__q2ws_id" && value != null && String(value).trim());
    if (nextProperty) return String(nextProperty[1]).trim();
    const featureIndex = layer.geojson.features.findIndex((candidate) => candidate === feature);
    if (featureIndex >= 0) return `${layer.displayName} #${featureIndex + 1}`;
    const fallback = String(properties.__q2ws_id ?? feature.id ?? `${layer.displayName} feature`);
    return fallback.length > 32 ? `${fallback.slice(0, 31)}…` : fallback;
  }

  function updateSelectedFeatureField(field: string, value: string) {
    if (!project || !selectedLayer || !selectedFeatureData) return;
    const featureId = selectedFeatureIdValue();
    updateProject(
      updateFeatureProperty(project, selectedLayer.id, featureId, field, value),
      { label: `Edit ${field}`, group: `feature-property:${selectedLayer.id}:${featureId}:${field}`, coalesceMs: 600 }
    );
  }

  function addSelectedFeatureProperty() {
    if (!project || !selectedLayer || !selectedFeatureData) return;
    if (!newFeaturePropertyKey.trim()) return;
    const featureId = selectedFeatureIdValue();
    updateProject(
      addFeatureProperty(project, selectedLayer.id, featureId, newFeaturePropertyKey, newFeaturePropertyValue),
      { label: `Add ${newFeaturePropertyKey.trim()}`, group: `feature-property-add:${selectedLayer.id}:${featureId}:${newFeaturePropertyKey.trim()}` }
    );
    setNewFeaturePropertyKey("");
    setNewFeaturePropertyValue("");
    toast.success("Property added to selected feature");
  }

  function removeSelectedFeatureProperty(field: string) {
    if (!project || !selectedLayer || !selectedFeatureData) return;
    const featureId = selectedFeatureIdValue();
    updateProject(
      deleteFeatureProperty(project, selectedLayer.id, featureId, field),
      { label: `Delete ${field}`, group: `feature-property-delete:${selectedLayer.id}:${featureId}:${field}` }
    );
    toast.success("Property removed from selected feature");
  }

  function renameSelectedPopupField(oldKey: string, newKey: string) {
    if (!project || !selectedLayer) return;
    updateProject(renameField(project, selectedLayer.id, oldKey, newKey));
  }

  function ensureLayerLabel(layer: LayerManifest) {
    const firstField = fieldNames(layer)[0] || "";
    return layer.label || {
      enabled: false,
      field: firstField,
      permanent: true,
      offset: [0, -16] as [number, number],
      className: "",
      htmlTemplate: firstField ? `{{${firstField}}}` : "",
      cssText: "",
      fontSize: 12,
      textColor: "#172026",
      haloColor: "#ffffff"
    };
  }

  function ensurePopupTemplate(layer: LayerManifest) {
    return layer.popupTemplate || {
      mode: "field-grid" as const,
      source: "studio" as const,
      html: popupHtmlFromLayer(layer),
      fields: layer.popupFields
    };
  }

  function setMapSetting<K extends keyof Qgis2webProject["mapSettings"]>(key: K, value: Qgis2webProject["mapSettings"][K]) {
    if (!project) return;
    const nextProject = { ...project, mapSettings: { ...project.mapSettings, [key]: value } };
    updateProject(
      key === "layerControlMode"
        ? {
            ...nextProject,
            layerControlSettings: {
              ...nextProject.layerControlSettings,
              mode: value as Qgis2webProject["layerControlSettings"]["mode"]
            }
          }
        : nextProject
    );
  }

  function resetToExportView() {
    if (!project) return;
    updateProject({
      ...project,
      mapSettings: {
        ...project.mapSettings,
        initialZoomMode: "export-original"
      }
    });
  }

  function setLayerControlSetting<K extends keyof Qgis2webProject["layerControlSettings"]>(key: K, value: Qgis2webProject["layerControlSettings"][K]) {
    if (!project) return;
    const layerControlSettings = { ...project.layerControlSettings, [key]: value };
    updateProject({
      ...project,
      layerControlSettings,
      mapSettings: {
        ...project.mapSettings,
        layerControlMode: key === "mode" ? (value as Qgis2webProject["mapSettings"]["layerControlMode"]) : project.mapSettings.layerControlMode
      }
    });
  }

  function setPopupSetting<K extends keyof Qgis2webProject["popupSettings"]>(key: K, value: Qgis2webProject["popupSettings"][K]) {
    if (!project) return;
    updateProject({ ...project, popupSettings: { ...project.popupSettings, [key]: value } });
  }

  function setLegendSetting<K extends keyof Qgis2webProject["legendSettings"]>(key: K, value: Qgis2webProject["legendSettings"][K]) {
    if (!project) return;
    updateProject({ ...project, legendSettings: { ...project.legendSettings, [key]: value } });
  }

  function toggleRuntimeWidget(widgetId: string, enabled: boolean) {
    if (!project) return;
    updateProject({
      ...project,
      runtime: {
        ...project.runtime,
        widgets: project.runtime.widgets.map((widget) => (widget.id === widgetId ? { ...widget, enabled } : widget))
      }
    });
  }

  function setDefaultBasemap(basemapId: string) {
    if (!project) return;
    updateProject({
      ...project,
      mapSettings: { ...project.mapSettings, basemap: basemapId },
      basemaps: project.basemaps.map((basemap) => ({ ...basemap, default: basemap.id === basemapId }))
    });
  }

  function addPresetBasemap(template: BasemapConfig) {
    if (!project) return;
    if (project.basemaps.some((basemap) => basemap.id === template.id || basemap.url === template.url)) return;
    updateProject({
      ...project,
      basemaps: [...project.basemaps, { ...template, default: false, enabled: true, source: "user" }]
    });
  }

  function addCustomBasemap() {
    if (!project) return;
    const id = `custom-${Date.now()}`;
    updateProject({
      ...project,
      basemaps: [
        ...project.basemaps,
        {
          id,
          label: "New basemap",
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "OpenStreetMap",
          maxZoom: 19,
          default: false,
          enabled: true,
          source: "user"
        }
      ]
    });
  }

  function removeBasemap(basemapId: string) {
    if (!project || project.basemaps.length <= 1) return;
    const remaining = project.basemaps.filter((basemap) => basemap.id !== basemapId);
    const needsNewDefault = !remaining.some((basemap) => basemap.default);
    if (needsNewDefault && remaining.length > 0) remaining[0].default = true;
    updateProject({
      ...project,
      mapSettings: {
        ...project.mapSettings,
        basemap: project.mapSettings.basemap === basemapId ? (remaining[0]?.id || "none") : project.mapSettings.basemap
      },
      basemaps: remaining
    });
  }

  function updateBasemapField<K extends keyof Qgis2webProject["basemaps"][number]>(basemapId: string, field: K, value: Qgis2webProject["basemaps"][number][K]) {
    if (!project) return;
    updateProject({
      ...project,
      basemaps: project.basemaps.map((basemap) => basemap.id === basemapId ? { ...basemap, [field]: value } : basemap)
    });
  }

  function moveBasemap(basemapId: string, direction: -1 | 1) {
    if (!project) return;
    const index = project.basemaps.findIndex((basemap) => basemap.id === basemapId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= project.basemaps.length) return;
    const basemaps = [...project.basemaps];
    const [item] = basemaps.splice(index, 1);
    basemaps.splice(nextIndex, 0, item);
    updateProject({
      ...project,
      basemaps
    });
  }

  function addManualLegend() {
    if (!project) return;
    updateProject({
      ...project,
      manualLegendItems: [
        ...project.manualLegendItems,
        {
          id: crypto.randomUUID(),
          label: "Manual legend item",
          fillColor: project.theme.accent,
          strokeColor: "#172026",
          strokeWidth: 2,
          dashArray: "",
          symbolType: "polygon",
          sourceImagePath: "",
          visible: true
        }
      ]
    });
  }

  function addTextAnnotation() {
    if (!project) return;
    const center = projectCenter(project);
    const annotation: TextAnnotation = {
      type: "Feature",
      id: crypto.randomUUID(),
      properties: {
        text: "New label",
        fontSize: 14,
        color: project.theme.text,
        anchor: "center"
      },
      geometry: {
        type: "Point",
        coordinates: center
      } satisfies Point
    };
    updateProject({ ...project, textAnnotations: [...project.textAnnotations, annotation] });
  }

  const selectedGeometryKind = selectedLayer ? geometryKindOf(selectedLayer.geometryType) : "unknown";
  const selectedLayerHasMultiGeometry = Boolean(selectedLayer && layerHasMultiGeometry(selectedLayer));
  const canEditGeometry = Boolean(selectedLayer && !selectedLayerHasMultiGeometry);

  function setDrawModeWithGuard(nextMode: DrawMode) {
    if (nextMode === "lasso") {
      if (!selectedLayer) return;
      setDrawMode("lasso");
      return;
    }
    if (nextMode === "delete") {
      if (!canEditGeometry) return;
      setDrawMode("delete");
      return;
    }
    if (nextMode === "select") {
      if (!canEditGeometry) return;
      setDrawMode("select");
      return;
    }
    if (!selectedLayer || !canEditGeometry) return;
    if (nextMode === "point" && selectedGeometryKind !== "point") return;
    if (nextMode === "linestring" && selectedGeometryKind !== "line") return;
    if ((nextMode === "polygon" || nextMode === "rectangle" || nextMode === "circle") && selectedGeometryKind !== "polygon") return;
    setDrawMode(nextMode);
  }

  function simplifySelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const { layer, feature } = selectedFeatureData;
    if (!layer.geometryType.includes("Line") && !layer.geometryType.includes("Polygon")) {
      toast.warning("Simplify is available for line and polygon features.");
      return;
    }
    if (!feature.geometry) {
      toast.warning("Selected feature has no geometry to simplify.");
      return;
    }
    const featureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "");
    const simplified = simplify(feature as Feature, { tolerance: 0.00008, highQuality: true, mutate: false }) as Feature;
    if (!simplified.geometry || JSON.stringify(simplified.geometry) === JSON.stringify(feature.geometry)) {
      toast.info("Selected feature is already simple enough.");
      return;
    }
    const features = layer.geojson.features.map((candidate) =>
      String(candidate.properties?.__q2ws_id ?? candidate.id ?? "") === featureId
        ? { ...candidate, geometry: simplified.geometry }
        : candidate
    );
    updateProject(updateLayerGeojson(project, layer.id, { ...layer.geojson, features }), {
      label: "Simplify selected feature",
      group: `simplify-feature:${layer.id}:${featureId}`
    });
    toast.success("Selected feature simplified");
  }

  function bufferSelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const distanceText = window.prompt("Buffer distance in meters", "100");
    if (!distanceText) return;
    const distance = Number(distanceText);
    if (!Number.isFinite(distance) || distance <= 0) {
      toast.warning("Enter a positive buffer distance in meters.");
      return;
    }
    if (!selectedFeatureData.feature.geometry) {
      toast.warning("Selected feature has no geometry to buffer.");
      return;
    }
    const buffered = turfBuffer(selectedFeatureData.feature, distance, { units: "meters", steps: 16 });
    if (!buffered || buffered.type !== "Feature") {
      toast.error("Buffer could not be created for the selected feature.");
      return;
    }
    const sourceLayer = selectedFeatureData.layer;
    const sourceFeatureId = String(selectedFeatureData.feature.properties?.__q2ws_id ?? selectedFeatureData.feature.id ?? "feature");
    const bufferId = `${sourceLayer.id}-buffer-${Math.round(distance)}m-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
    const outputLayer: LayerManifest = {
      ...sourceLayer,
      id: bufferId,
      displayName: `${sourceLayer.displayName} buffer ${distance} m`,
      sourcePath: `${project.name}/data/${bufferId}.js`,
      dataVariable: `json_${bufferId}`,
      layerVariable: `layer_${bufferId}`,
      geometryType: buffered.geometry.type,
      visible: true,
      showInLayerControl: true,
      popupEnabled: true,
      legendEnabled: true,
      layerTreeGroup: "Analysis",
      label: undefined,
      popupFields: [
        { key: "source_layer", label: "source_layer", visible: true, header: false },
        { key: "source_feature", label: "source_feature", visible: true, header: false },
        { key: "buffer_m", label: "buffer_m", visible: true, header: false }
      ],
      popupTemplate: undefined,
      geojson: {
        type: "FeatureCollection",
        features: [{
          ...buffered,
          id: `${bufferId}::${sourceFeatureId}`,
          properties: {
            ...(buffered.properties || {}),
            __q2ws_id: `${bufferId}::${sourceFeatureId}`,
            source_layer: sourceLayer.displayName,
            source_feature: sourceFeatureId,
            buffer_m: distance
          }
        }]
      },
      style: {
        ...sourceLayer.style,
        fillColor: "#ff7a18",
        strokeColor: "#ff7a18",
        fillOpacity: 0.25,
        strokeOpacity: 0.95,
        strokeWidth: 2,
        dashArray: "",
        symbolType: "polygon"
      }
    };
    updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Buffer ${sourceLayer.displayName}` });
    setSelectedLayerId(outputLayer.id);
    setSelectedFeature(null);
    setInspectorMode("layer");
    toast.success("Buffer layer created");
  }

  function mergeSelectedLayer() {
    if (!project || !selectedLayer) return;
    if (!selectedLayer.geometryType.includes("Polygon")) {
      toast.warning("Merge is available for polygon layers.");
      return;
    }
    const polygonFeatures = selectedLayer.geojson.features.filter(
      (feature): feature is Feature<GeoJsonPolygon | MultiPolygon> =>
        feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon"
    );
    if (polygonFeatures.length < 2) {
      toast.warning("Merge requires at least two polygon features in the layer.");
      return;
    }
    let merged: Feature<GeoJsonPolygon | MultiPolygon> | null = null;
    for (const feature of polygonFeatures) {
      if (!merged) {
        merged = feature;
        continue;
      }
      try {
        if (new URLSearchParams(window.location.search).get("forceMergeUnionError") === "1") {
          throw new Error("Forced merge union failure");
        }
        const candidate: Feature<GeoJsonPolygon | MultiPolygon> | null = union(featureCollection([merged, feature]));
        if (candidate) merged = candidate;
      } catch (error) {
        console.warn("Merge failed while unioning polygon features", error);
        toast.error("Merge failed. No output layer was created because at least one polygon could not be unioned.");
        return;
      }
    }
    if (!merged || !merged.geometry) {
      toast.error("Merge produced no valid geometry.");
      return;
    }
    const sourceLayer = selectedLayer;
    const mergeId = `${sourceLayer.id}-merged-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
    const outputLayer: LayerManifest = {
      ...sourceLayer,
      id: mergeId,
      displayName: `${sourceLayer.displayName} merge`,
      sourcePath: `${project.name}/data/${mergeId}.js`,
      dataVariable: `json_${mergeId}`,
      layerVariable: `layer_${mergeId}`,
      geometryType: merged.geometry.type,
      visible: true,
      showInLayerControl: true,
      popupEnabled: true,
      legendEnabled: true,
      layerTreeGroup: "Analysis",
      label: undefined,
      popupFields: [
        { key: "source_layer", label: "source_layer", visible: true, header: false },
        { key: "feature_count", label: "feature_count", visible: true, header: false }
      ],
      popupTemplate: undefined,
      geojson: {
        type: "FeatureCollection",
        features: [{
          ...merged,
          id: `${mergeId}::merged`,
          properties: {
            ...(merged.properties || {}),
            __q2ws_id: `${mergeId}::merged`,
            source_layer: sourceLayer.displayName,
            feature_count: polygonFeatures.length
          }
        }]
      },
      style: {
        ...sourceLayer.style,
        fillColor: "#ff7a18",
        strokeColor: "#ff7a18",
        fillOpacity: 0.25,
        strokeOpacity: 0.95,
        strokeWidth: 2,
        dashArray: "",
        symbolType: "polygon"
      }
    };
    updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Merge ${sourceLayer.displayName}` });
    setSelectedLayerId(outputLayer.id);
    setSelectedFeature(null);
    setInspectorMode("layer");
    toast.success("Merge layer created");
  }

  function polygonToLineSelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const { layer: sourceLayer, feature } = selectedFeatureData;
    if (!feature.geometry) {
      toast.warning("Selected feature has no geometry to convert.");
      return;
    }
    if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") {
      toast.warning("Polygon to line is available for polygon features.");
      return;
    }
    const lineOutput = polygonToLine(feature as Feature<GeoJsonPolygon | MultiPolygon>);
    const lineFeatures = lineOutput.type === "FeatureCollection" ? lineOutput.features : [lineOutput];
    const outputGeometryType = lineFeatures[0]?.geometry?.type;
    if (lineFeatures.length === 0 || !outputGeometryType) {
      toast.error("Polygon to line output could not be created.");
      return;
    }
    const sourceFeatureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "feature");
    const outputId = `${sourceLayer.id}-polygon-to-line-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
    const outputLayer: LayerManifest = {
      ...sourceLayer,
      id: outputId,
      displayName: `${sourceLayer.displayName} polygon to line`,
      sourcePath: `${project.name}/data/${outputId}.js`,
      dataVariable: `json_${outputId}`,
      layerVariable: `layer_${outputId}`,
      geometryType: outputGeometryType,
      visible: true,
      showInLayerControl: true,
      popupEnabled: true,
      legendEnabled: true,
      layerTreeGroup: "Analysis",
      label: undefined,
      popupFields: [
        { key: "source_layer", label: "source_layer", visible: true, header: false },
        { key: "source_feature", label: "source_feature", visible: true, header: false }
      ],
      popupTemplate: undefined,
      geojson: {
        type: "FeatureCollection",
        features: lineFeatures.map((lineFeature: Feature<LineString | MultiLineString>, index: number) => ({
          ...lineFeature,
          id: `${outputId}::${sourceFeatureId}::${index}`,
          properties: {
            ...(lineFeature.properties || {}),
            __q2ws_id: `${outputId}::${sourceFeatureId}::${index}`,
            source_layer: sourceLayer.displayName,
            source_feature: sourceFeatureId
          }
        }))
      },
      style: {
        ...sourceLayer.style,
        fillOpacity: 0,
        strokeColor: "#ff7a18",
        strokeOpacity: 0.95,
        strokeWidth: 3,
        dashArray: "6 4",
        symbolType: "line"
      }
    };
    updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Polygon to line ${sourceLayer.displayName}` });
    setSelectedLayerId(outputLayer.id);
    setSelectedFeature(null);
    setInspectorMode("layer");
    toast.success("Polygon to line layer created");
  }

  function convexHullSelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const { layer, feature } = selectedFeatureData;
    if (!layer.geometryType.includes("Line") && !layer.geometryType.includes("Polygon")) {
      toast.warning("Convex hull is available for line and polygon features.");
      return;
    }
    if (!feature.geometry) {
      toast.warning("Selected feature has no geometry for convex hull.");
      return;
    }
    const hulled = convex(feature);
    if (!hulled?.geometry) {
      toast.info("Selected feature does not have enough geometry for a convex hull.");
      return;
    }
    const sourceFeatureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "feature");
    const hullId = `${layer.id}-convex_hull-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
    const outputLayer: LayerManifest = {
      ...layer,
      id: hullId,
      displayName: `${layer.displayName} convex hull`,
      sourcePath: `${project.name}/data/${hullId}.js`,
      dataVariable: `json_${hullId}`,
      layerVariable: `layer_${hullId}`,
      geometryType: hulled.geometry.type,
      visible: true,
      showInLayerControl: true,
      popupEnabled: true,
      legendEnabled: true,
      layerTreeGroup: "Analysis",
      label: undefined,
      popupFields: [
        { key: "source_layer", label: "source_layer", visible: true, header: false },
        { key: "source_feature", label: "source_feature", visible: true, header: false },
        { key: "operation", label: "operation", visible: true, header: false }
      ],
      popupTemplate: undefined,
      geojson: {
        type: "FeatureCollection",
        features: [{
          ...hulled,
          id: `${hullId}::${sourceFeatureId}`,
          properties: {
            ...(hulled.properties || {}),
            __q2ws_id: `${hullId}::${sourceFeatureId}`,
            source_layer: layer.displayName,
            source_feature: sourceFeatureId,
            operation: "convex_hull"
          }
        }]
      },
      style: {
        ...layer.style,
        fillColor: "#7c3aed",
        strokeColor: "#7c3aed",
        fillOpacity: 0.2,
        strokeOpacity: 0.95,
        strokeWidth: 2,
        dashArray: "6 4",
        symbolType: "polygon"
      }
    };
    updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Convex hull ${layer.displayName}` });
    setSelectedLayerId(outputLayer.id);
    setSelectedFeature(null);
    setInspectorMode("layer");
    toast.success("Convex hull layer created");
  }

  function selectAllFeatures() {
    if (!project || !selectedLayer) return;
    const allIds = selectedLayer.geojson.features.map((feature) =>
      String(feature.properties?.__q2ws_id ?? feature.id ?? "")
    );
    setSelectedFeatureIds(allIds);
    toast.info(`Selected ${allIds.length} features`);
  }

  function clearSelection() {
    setSelectedFeatureIds([]);
    setSelectedFeature(null);
    toast.info("Selection cleared");
  }

  function translateSelectedFeatures() {
    if (!project || !selectedLayer || selectedFeatureIds.length === 0) return;
    const deltaText = window.prompt("Translate selected features by dx, dy in coordinate units", "0, 0");
    if (!deltaText) return;
    const deltaTokens = deltaText.trim().split(/[\s,]+/).filter(Boolean);
    if (deltaTokens.length !== 2) {
      toast.warning("Enter numeric dx and dy values.");
      return;
    }
    const [dx, dy] = deltaTokens.map(Number);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      toast.warning("Enter numeric dx and dy values.");
      return;
    }
    const selectedIds = new Set(selectedFeatureIds);
    let translatedCount = 0;
    const features = selectedLayer.geojson.features.map((feature) => {
      const featureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "");
      if (!selectedIds.has(featureId) || !feature.geometry || !isSimpleEditableGeometry(feature.geometry)) return feature;
      translatedCount += 1;
      return { ...feature, geometry: translateGeometry(feature.geometry, dx, dy) };
    });
    if (translatedCount === 0) {
      toast.warning("No selected simple features to translate.");
      return;
    }
    updateProject(updateLayerGeojson(project, selectedLayer.id, { ...selectedLayer.geojson, features }), {
      label: "Translate selected features",
      group: `translate-features:${selectedLayer.id}`
    });
    toast.success(`Translated ${translatedCount} feature${translatedCount === 1 ? "" : "s"}`);
  }

  function rotateSelectedFeatures() {
    if (!project || !selectedLayer || selectedFeatureIds.length === 0) return;
    const angleText = window.prompt("Rotate selected features by degrees", "0");
    if (!angleText) return;
    const angle = Number(angleText.trim());
    if (!Number.isFinite(angle)) {
      toast.warning("Enter a numeric degree value.");
      return;
    }
    const selectedIds = new Set(selectedFeatureIds);
    let rotatedCount = 0;
    const features = selectedLayer.geojson.features.map((feature) => {
      const featureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "");
      if (!selectedIds.has(featureId) || !feature.geometry || !isSimpleEditableGeometry(feature.geometry)) return feature;
      rotatedCount += 1;
      return { ...feature, geometry: rotateGeometry(feature.geometry, angle) };
    });
    if (rotatedCount === 0) {
      toast.warning("No selected simple features to rotate.");
      return;
    }
    updateProject(updateLayerGeojson(project, selectedLayer.id, { ...selectedLayer.geojson, features }), {
      label: "Rotate selected features",
      group: `rotate-features:${selectedLayer.id}`
    });
    toast.success(`Rotated ${rotatedCount} feature${rotatedCount === 1 ? "" : "s"}`);
  }

  function scaleSelectedFeatures() {
    if (!project || !selectedLayer || selectedFeatureIds.length === 0) return;
    const factorText = window.prompt("Scale selected features by factor", "1");
    if (!factorText) return;
    const factor = Number(factorText.trim());
    if (!Number.isFinite(factor) || factor <= 0) {
      toast.warning("Enter a positive numeric scale factor.");
      return;
    }
    const selectedIds = new Set(selectedFeatureIds);
    let scaledCount = 0;
    const features = selectedLayer.geojson.features.map((feature) => {
      const featureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "");
      if (!selectedIds.has(featureId) || !feature.geometry || !isSimpleEditableGeometry(feature.geometry)) return feature;
      scaledCount += 1;
      return { ...feature, geometry: scaleGeometry(feature.geometry, factor) };
    });
    if (scaledCount === 0) {
      toast.warning("No selected simple features to scale.");
      return;
    }
    updateProject(updateLayerGeojson(project, selectedLayer.id, { ...selectedLayer.geojson, features }), {
      label: "Scale selected features",
      group: `scale-features:${selectedLayer.id}`
    });
    toast.success(`Scaled ${scaledCount} feature${scaledCount === 1 ? "" : "s"}`);
  }

  const handleLassoComplete = useCallback((polygon: GeoJsonPolygon) => {
    if (!selectedLayer) return;
    const selectedIds = selectedLayer.geojson.features
      .filter((feature) => {
        const point = representativePoint(feature.geometry);
        return point ? booleanPointInPolygon(point, polygon) : false;
      })
      .map((feature) => String(feature.properties?.__q2ws_id ?? feature.id ?? ""))
      .filter(Boolean);
    setSelectedFeatureIds(selectedIds);
    setSelectedFeature(null);
    toast.info(`Lasso selected ${selectedIds.length} features`);
  }, [selectedLayer]);

  function splitLineSelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const { layer, feature } = selectedFeatureData;
    if (!layer.geometryType.includes("Line")) {
      toast.warning("Split line is available for line features only.");
      return;
    }
    if (!feature.geometry) {
      toast.warning("Selected feature has no geometry to split.");
      return;
    }
    try {
      const lineFeature = feature as Feature<LineString | MultiLineString>;
      const lineParts = lineFeature.geometry.type === "MultiLineString"
        ? lineFeature.geometry.coordinates
        : [lineFeature.geometry.coordinates];
      const segments = lineParts.flatMap((coordinates) => splitLinePartAtMidpoint(coordinates as Array<[number, number]>));
      if (segments.length === 0) {
        toast.warning("Selected feature has zero length, cannot split.");
        return;
      }
      const sourceFeatureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "feature");
      const splitId = `${layer.id}-split_midpoint-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
      const outputLayer = buildLineOperationLayer(project, layer, splitId, `${layer.displayName} split midpoint`, sourceFeatureId, "split_line", segments, {
        fillColor: "#7c3aed",
        strokeColor: "#7c3aed",
        fillOpacity: 0.2,
        strokeOpacity: 0.95,
        strokeWidth: 2,
        dashArray: "4 4"
      });
      updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Split ${layer.displayName} at midpoint` });
      setSelectedLayerId(outputLayer.id);
      setSelectedFeature(null);
      setInspectorMode("layer");
      toast.success("Line split at midpoint");
    } catch (error) {
      console.error("Failed to split line:", error);
      toast.error("Failed to split line. Check console for details.");
    }
  }

  function divideLineSelectedFeature() {
    if (!project || !selectedFeatureData) return;
    const { layer, feature } = selectedFeatureData;
    if (!layer.geometryType.includes("Line")) {
      toast.warning("Divide line is available for line features only.");
      return;
    }
    if (!feature.geometry) {
      toast.warning("Selected feature has no geometry to divide.");
      return;
    }
    try {
      const lineFeature = feature as Feature<LineString | MultiLineString>;
      const lineParts = lineFeature.geometry.type === "MultiLineString"
        ? lineFeature.geometry.coordinates
        : [lineFeature.geometry.coordinates];
      const segments = lineParts.flatMap((coordinates) => divideLinePart(coordinates as Array<[number, number]>, DIVIDE_PARTS));
      if (segments.length === 0) {
        toast.warning("Selected feature has zero length, cannot divide.");
        return;
      }
      const sourceFeatureId = String(feature.properties?.__q2ws_id ?? feature.id ?? "feature");
      const divideId = `${layer.id}-divided-${DIVIDE_PARTS}-parts-${Date.now()}`.replace(/[^A-Za-z0-9_]/g, "_");
      const outputLayer = buildLineOperationLayer(project, layer, divideId, `${layer.displayName} divided (${DIVIDE_PARTS} parts)`, sourceFeatureId, "divide_line", segments, {
        fillColor: "#059669",
        strokeColor: "#059669",
        fillOpacity: 0.2,
        strokeOpacity: 0.95,
        strokeWidth: 2,
        dashArray: "6 4"
      });
      updateProject({ ...project, layers: [...project.layers, outputLayer] }, { label: `Divide ${layer.displayName} into ${DIVIDE_PARTS} parts` });
      setSelectedLayerId(outputLayer.id);
      setSelectedFeature(null);
      setInspectorMode("layer");
      toast.success(`Line divided into ${DIVIDE_PARTS} equal segments`);
    } catch (error) {
      console.error("Failed to divide line:", error);
      toast.error("Failed to divide line. Check console for details.");
    }
  }

  return {
    project,
    setProject,
    selectedLayerId,
    setSelectedLayerId,
    selectedFeature,
    setSelectedFeature,
    selectedFeatureIds,
    setSelectedFeatureIds,
    inspectorMode,
    setInspectorMode,
    drawMode,
    setDrawMode,
    snapEnabled,
    setSnapEnabled,
    previewOpen,
    setPreviewOpen,
    attributeFilter,
    setAttributeFilter,
    status,
    setStatus,
    busy,
    setBusy,
    history,
    setHistory,
    selectedProjectLayer,
    selectedLayer,
    selectedFeatureData,
    newFeaturePropertyKey,
    setNewFeaturePropertyKey,
    newFeaturePropertyValue,
    setNewFeaturePropertyValue,
    updateProject,
    undoProject,
    redoProject,
    warnAboutLargeDatasets,
    handleTileError,
    handleSelectedFeatureChange,
    patchSelectedLayer,
    updateRasterLayer,
    selectedFeatureTitle,
    updateSelectedFeatureField,
    addSelectedFeatureProperty,
    removeSelectedFeatureProperty,
    renameSelectedPopupField,
    ensureLayerLabel,
    ensurePopupTemplate,
    setMapSetting,
    resetToExportView,
    setLayerControlSetting,
    setPopupSetting,
    setLegendSetting,
    toggleRuntimeWidget,
    setDefaultBasemap,
    addPresetBasemap,
    addCustomBasemap,
    removeBasemap,
    updateBasemapField,
    moveBasemap,
    addManualLegend,
    addTextAnnotation,
    setDrawModeWithGuard,
    simplifySelectedFeature,
    bufferSelectedFeature,
    mergeSelectedLayer,
    selectAllFeatures,
    clearSelection,
    translateSelectedFeatures,
    rotateSelectedFeatures,
    scaleSelectedFeatures,
    handleLassoComplete,
    splitLineSelectedFeature,
    divideLineSelectedFeature,
    polygonToLineSelectedFeature,
    convexHullSelectedFeature
  };
}

function pushHistoryEntry(entries: HistoryEntry[], entry: HistoryEntry, coalesceMs: number): HistoryEntry[] {
  const previous = entries[entries.length - 1];
  if (coalesceMs > 0 && entry.group && previous?.group === entry.group && entry.updatedAt - previous.updatedAt <= coalesceMs) {
    return [...entries.slice(0, -1), { ...previous, label: entry.label }];
  }
  return [...entries.slice(-(HISTORY_LIMIT - 1)), entry];
}
