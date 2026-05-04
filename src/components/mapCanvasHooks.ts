import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode
} from "terra-draw";
import { TerraDrawLeafletAdapter } from "terra-draw-leaflet-adapter";
import { styleForFeature } from "../lib/style";
import { shouldSimplifyLayer, simplifyLayersForPreview } from "../lib/simplifyClient";
import type { BasemapConfig, DrawMode, LayerManifest, Qgis2webProject, RasterImageLayer, RasterPmtilesLayer, RasterWmsLayer, SelectedFeatureRef, TextAnnotation } from "../types/project";
import { updateLayerGeojson } from "../lib/projectUpdates";
import { buildLabel, buildPopup, createBasemap, escapeHtml, fromTerraDrawFeature, pointClusterIcon, projectBounds, shouldClusterLayer, toTerraDrawFeatures } from "./mapCanvasHelpers";

export type LeafletMapState = {
  containerRef: RefObject<HTMLDivElement>;
  mapRef: MutableRefObject<L.Map | null>;
  mapZoom: number;
  mapInstanceVersion: number;
  debugEnabled: boolean;
};

export function useLeafletMap(): LeafletMapState {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapInstanceVersionRef = useRef(0);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapInstanceVersion, setMapInstanceVersion] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapInstanceVersionRef.current += 1;
    const nextMapInstanceVersion = mapInstanceVersionRef.current;
    setMapInstanceVersion(nextMapInstanceVersion);
    const map = L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true,
      center: [-2.5, 117.5],
      zoom: 4
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const updateZoom = () => setMapZoom(map.getZoom());
    map.on("zoomend", updateZoom);
    mapRef.current = map;
    const debugEnabled = new URLSearchParams(window.location.search).has("debug");
    if (debugEnabled) {
      (window as Window & { __q2ws_map?: L.Map; __q2wsDebugEvents?: unknown[] }).__q2ws_map = map;
      (window as Window & { __q2wsDebugEvents?: unknown[] }).__q2wsDebugEvents = [];
      attachMapDebugEvents(map);
    }
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.off("zoomend", updateZoom);
      map.remove();
      mapRef.current = null;
      const debugWindow = window as Window & { __q2ws_map?: L.Map };
      if (debugWindow.__q2ws_map === map) delete debugWindow.__q2ws_map;
    };
  }, []);

  const debugEnabled = new URLSearchParams(window.location.search).has("debug");
  return { containerRef, mapRef, mapZoom, mapInstanceVersion, debugEnabled };
}

function attachMapDebugEvents(map: L.Map) {
  ["zoomstart", "zoomend", "movestart", "moveend", "dragstart", "dragend"].forEach((eventName) => {
    map.on(eventName, () => {
      debugLog("map", eventName, {
        center: map.getCenter(),
        zoom: map.getZoom()
      });
    });
  });
}

function debugLog(source: string, event: string, detail: Record<string, unknown> = {}) {
  const debugWindow = window as Window & { __q2wsDebugEvents?: unknown[] };
  if (!debugWindow.__q2wsDebugEvents) return;
  const entry = { at: Date.now(), source, event, ...detail };
  debugWindow.__q2wsDebugEvents.push(entry);
  console.debug("[q2ws-debug]", entry);
}

function snapOptions(enabled: boolean) {
  return enabled
    ? {
        toLine: true,
        toCoordinate: true
      }
    : undefined;
}

export function useBasemap(mapRef: MutableRefObject<L.Map | null>, mapInstanceVersion: number, basemaps: BasemapConfig[], activeBasemapId: string, onTileError?: (message: string) => void) {
  const basemapRef = useRef<L.TileLayer | null>(null);
  const tileErrorShownRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    basemapRef.current?.remove();
    basemapRef.current = null;
    tileErrorShownRef.current = false;
    const basemap = createBasemap(basemaps, activeBasemapId);
    if (!basemap) return;
    basemap.on("tileerror", () => {
      if (tileErrorShownRef.current) return;
      tileErrorShownRef.current = true;
      onTileError?.("Basemap failed to load. Check your connection or pick a different basemap.");
    });
    basemap.addTo(map);
    basemapRef.current = basemap;
    return () => {
      basemapRef.current?.remove();
      basemapRef.current = null;
    };
  }, [activeBasemapId, basemaps, mapInstanceVersion, mapRef, onTileError]);
}

export function useSimplifiedLayers(visibleLayers: LayerManifest[], mapZoom: number): Record<string, FeatureCollection> {
  const simplifyRequestRef = useRef(0);
  const [simplifiedLayers, setSimplifiedLayers] = useState<Record<string, FeatureCollection>>({});

  useEffect(() => {
    const requestId = simplifyRequestRef.current + 1;
    simplifyRequestRef.current = requestId;
    const candidates = visibleLayers.filter((layer) => shouldSimplifyLayer(layer, mapZoom));
    if (candidates.length === 0) {
      setSimplifiedLayers((current) => (Object.keys(current).length ? {} : current));
      return;
    }
    let cancelled = false;
    simplifyLayersForPreview(candidates, mapZoom)
      .then((next) => {
        if (!cancelled && simplifyRequestRef.current === requestId) setSimplifiedLayers(next);
      })
      .catch((error) => {
        if (!cancelled && simplifyRequestRef.current === requestId) {
          console.warn("Preview simplification failed", error);
          setSimplifiedLayers((current) => (Object.keys(current).length ? {} : current));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mapZoom, visibleLayers]);

  return simplifiedLayers;
}

export function useRasterLayers(mapRef: MutableRefObject<L.Map | null>, mapInstanceVersion: number, layers: Array<RasterImageLayer | RasterWmsLayer | RasterPmtilesLayer>) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layerGroup = L.layerGroup().addTo(map);
    layers.forEach((layer) => {
      if (layer.visible === false) return;
      if (layer.kind === "raster-image") {
        L.imageOverlay(layer.imagePath, layer.bounds, { opacity: layer.opacity }).addTo(layerGroup);
        return;
      }
      if (layer.kind === "raster-wms") {
        L.tileLayer.wms(layer.url, {
          layers: layer.layersParam,
          format: layer.format,
          transparent: layer.transparent,
          version: layer.version,
          attribution: layer.attribution,
          opacity: layer.opacity
        }).addTo(layerGroup);
        return;
      }
    });
    return () => {
      layerGroup.remove();
    };
  }, [layers, mapInstanceVersion, mapRef]);
}

export function useRasterImageLayers(mapRef: MutableRefObject<L.Map | null>, mapInstanceVersion: number, layers: RasterImageLayer[]) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layerGroup = L.layerGroup().addTo(map);
    layers.forEach((layer) => {
      if (layer.visible === false) return;
      L.imageOverlay(layer.imagePath, layer.bounds, { opacity: layer.opacity }).addTo(layerGroup);
    });
    return () => {
      layerGroup.remove();
    };
  }, [layers, mapInstanceVersion, mapRef]);
}

export function useGeoJsonLayers(
  mapRef: MutableRefObject<L.Map | null>,
  mapInstanceVersion: number,
  renderLayers: LayerManifest[],
  textAnnotations: TextAnnotation[],
  projectPopupSettings: Qgis2webProject["popupSettings"],
  selectedFeature: SelectedFeatureRef | null,
  selectedLayerId: string,
  selectedFeatureIds: string[],
  onSelectedFeatureChange: (selection: SelectedFeatureRef | null) => void
) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layerGroup = L.layerGroup().addTo(map);
    const featureId = (feature: Feature) => String(feature.properties?.__q2ws_id ?? feature.id ?? "");
    const multiSelectedIds = new Set(selectedFeatureIds);

    renderLayers.forEach((layer) => {
      const clusterPoints = shouldClusterLayer(layer);
      const geoLayer = L.geoJSON(layer.geojson, {
        style: (feature) => {
          const baseStyle = styleForFeature(layer, feature as Feature);
          const currentFeatureId = featureId(feature as Feature);
          const isSelected = selectedFeature?.layerId === layer.id && selectedFeature.featureId === currentFeatureId;
          const isMultiSelected = layer.id === selectedLayerId && multiSelectedIds.has(currentFeatureId);
          return isSelected
            ? {
                ...baseStyle,
                weight: Math.max((baseStyle.weight || layer.style.strokeWidth || 2) + 2, 3),
                color: "#ff7a18",
                fillOpacity: typeof baseStyle.fillOpacity === "number" ? Math.min(baseStyle.fillOpacity + 0.12, 1) : baseStyle.fillOpacity
              }
            : isMultiSelected
              ? {
                  ...baseStyle,
                  weight: Math.max((baseStyle.weight || layer.style.strokeWidth || 2) + 2, 3),
                  color: "#7c3aed",
                  fillOpacity: typeof baseStyle.fillOpacity === "number" ? Math.min(baseStyle.fillOpacity + 0.18, 1) : baseStyle.fillOpacity
                }
              : baseStyle;
        },
        pointToLayer: (feature, latlng) => {
          const currentFeatureId = featureId(feature as Feature);
          const isSelected = selectedFeature?.layerId === layer.id && selectedFeature.featureId === currentFeatureId;
          const isMultiSelected = layer.id === selectedLayerId && multiSelectedIds.has(currentFeatureId);
          if (clusterPoints) {
            return L.marker(latlng, { icon: pointClusterIcon(layer, feature as Feature) });
          }
          const baseStyle = styleForFeature(layer, feature as Feature);
          return L.circleMarker(latlng, {
            ...baseStyle,
            radius: isSelected || isMultiSelected ? layer.style.pointRadius + 4 : layer.style.pointRadius,
            ...(isSelected || isMultiSelected
              ? {
                  weight: Math.max((baseStyle.weight || layer.style.strokeWidth || 2) + 2, 3),
                  color: isSelected ? "#ff7a18" : "#7c3aed",
                  fillOpacity: typeof baseStyle.fillOpacity === "number" ? Math.min(baseStyle.fillOpacity + 0.12, 1) : baseStyle.fillOpacity
                }
              : {})
          });
        },
        onEachFeature: (feature, leafletLayer) => {
          const currentFeatureId = featureId(feature as Feature);
          leafletLayer.on("click", () => {
            onSelectedFeatureChange({ layerId: layer.id, featureId: currentFeatureId });
          });
          if (layer.label?.enabled && layer.label.field) {
            const labelValue = feature.properties?.[layer.label.field];
            if (labelValue != null && labelValue !== "") {
              leafletLayer.bindTooltip(buildLabel(layer, feature as Feature), {
                permanent: layer.label.permanent,
                offset: L.point((layer.label.offset || [0, 0])[0], (layer.label.offset || [0, 0])[1]),
                className: `studio-label ${layer.label.className || ""}`.trim()
              });
            }
          }
          if (!layer.popupEnabled) return;
          leafletLayer.bindPopup(buildPopup(layer, feature as Feature, projectPopupSettings), { className: layer.popupSettings ? `popup-layer-${layer.id}` : "" });
        }
      });
      if (clusterPoints) {
        const clusterGroup = L.markerClusterGroup({
          chunkedLoading: true,
          showCoverageOnHover: false,
          maxClusterRadius: 72
        });
        clusterGroup.addLayer(geoLayer);
        clusterGroup.addTo(layerGroup);
        return;
      }
      geoLayer.addTo(layerGroup);
    });

    textAnnotations.forEach((annotation) => {
      if (annotation.geometry.type !== "Point") return;
      const [lng, lat] = annotation.geometry.coordinates;
      const props = annotation.properties || {};
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: "text-annotation",
          html: `<span style="color:${props.color};font-size:${props.fontSize}px">${escapeHtml(props.text)}</span>`
        })
      }).addTo(layerGroup);
    });

    return () => {
      layerGroup.remove();
    };
  }, [mapInstanceVersion, mapRef, onSelectedFeatureChange, projectPopupSettings, renderLayers, selectedFeature, selectedFeatureIds, selectedLayerId, textAnnotations]);
}

export function useLassoSelection({
  mapRef,
  mapInstanceVersion,
  drawMode,
  lassoSelectionEnabled,
  preview,
  onDrawStatusChange,
  onLassoComplete
}: {
  mapRef: MutableRefObject<L.Map | null>;
  mapInstanceVersion: number;
  drawMode: DrawMode;
  lassoSelectionEnabled: boolean;
  preview: boolean;
  onDrawStatusChange: (status: string) => void;
  onLassoComplete: (polygon: Polygon) => void;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || preview || !lassoSelectionEnabled || drawMode !== "lasso") return;

    let drawing = false;
    let points: L.LatLng[] = [];
    let lassoLayer: L.Polygon | null = null;
    const container = map.getContainer();

    const finish = () => {
      if (!drawing) return;
      drawing = false;
      container.classList.remove("q2ws-lasso-active");
      map.dragging.enable();
      lassoLayer?.remove();
      lassoLayer = null;
      if (points.length < 3) {
        onDrawStatusChange("Lasso selection needs at least three points.");
        points = [];
        return;
      }
      const ring = points.map((point) => [point.lng, point.lat] as [number, number]);
      ring.push(ring[0]);
      points = [];
      onLassoComplete({ type: "Polygon", coordinates: [ring] });
    };

    const start = (event: L.LeafletMouseEvent) => {
      drawing = true;
      points = [event.latlng];
      container.classList.add("q2ws-lasso-active");
      map.dragging.disable();
      lassoLayer = L.polygon(points, {
        color: "#7c3aed",
        weight: 2,
        dashArray: "6 4",
        fillColor: "#7c3aed",
        fillOpacity: 0.12,
        interactive: false
      }).addTo(map);
      onDrawStatusChange("Drawing lasso selection...");
    };

    const move = (event: L.LeafletMouseEvent) => {
      if (!drawing || !lassoLayer) return;
      points.push(event.latlng);
      lassoLayer.setLatLngs(points);
    };

    map.on("mousedown", start);
    map.on("mousemove", move);
    map.on("mouseup", finish);
    map.on("mouseout", finish);
    onDrawStatusChange("Drag on the map to lasso features in the selected layer.");

    return () => {
      map.off("mousedown", start);
      map.off("mousemove", move);
      map.off("mouseup", finish);
      map.off("mouseout", finish);
      container.classList.remove("q2ws-lasso-active");
      map.dragging.enable();
      lassoLayer?.remove();
    };
  }, [drawMode, lassoSelectionEnabled, mapInstanceVersion, mapRef, onDrawStatusChange, onLassoComplete, preview]);
}

export function useAutoFit(
  mapRef: MutableRefObject<L.Map | null>,
  renderLayers: LayerManifest[],
  autoFitKey: string,
  initialZoomMode: Qgis2webProject["mapSettings"]["initialZoomMode"],
  initialZoom: number,
  initialBounds: Qgis2webProject["mapSettings"]["initialBounds"],
  initialCenter: Qgis2webProject["mapSettings"]["initialCenter"],
  mapInstanceVersion: number
) {
  const lastAutoFitKeyRef = useRef("");
  const programmaticMoveRef = useRef(false);
  const userMovedMapRef = useRef(false);

  useEffect(() => {
    lastAutoFitKeyRef.current = "";
    programmaticMoveRef.current = false;
    userMovedMapRef.current = false;
  }, [mapInstanceVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markUserMove = () => {
      if (!programmaticMoveRef.current) {
        userMovedMapRef.current = true;
        debugLog("autofit", "user-move-detected", { mapInstanceVersion });
      }
    };
    map.on("movestart", markUserMove);
    map.on("zoomstart", markUserMove);
    return () => {
      map.off("movestart", markUserMove);
      map.off("zoomstart", markUserMove);
    };
  }, [mapInstanceVersion, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const instanceAutoFitKey = `${mapInstanceVersion}::${autoFitKey}`;
    const shouldAutoFit = lastAutoFitKeyRef.current !== instanceAutoFitKey;
    map.invalidateSize();
    if (!shouldAutoFit) {
      debugLog("autofit", "skip-same-key", { autoFitKey: instanceAutoFitKey });
      return;
    }
    if (userMovedMapRef.current && lastAutoFitKeyRef.current) {
      const previousKey = lastAutoFitKeyRef.current;
      const previousParts = previousKey.split("::");
      const currentParts = instanceAutoFitKey.split("::");
      const zoomChanged = previousParts[previousParts.length - 1] !== currentParts[currentParts.length - 1]
        || previousParts[previousParts.length - 2] !== currentParts[currentParts.length - 2];
      if (!zoomChanged) {
        debugLog("autofit", "skip-after-user-move", { autoFitKey: instanceAutoFitKey, previousKey });
        return;
      }
    }
    lastAutoFitKeyRef.current = instanceAutoFitKey;
    const exportBounds = initialBounds ? L.latLngBounds(initialBounds) : null;
    const adaptiveBounds = projectBounds(renderLayers);
    const bounds = initialZoomMode === "fit" ? adaptiveBounds : exportBounds || adaptiveBounds;
    if (!bounds) {
      debugLog("autofit", "skip-no-bounds", { autoFitKey: instanceAutoFitKey });
      return;
    }
    programmaticMoveRef.current = true;
    debugLog("autofit", "apply", { autoFitKey: instanceAutoFitKey, mode: initialZoomMode, layerCount: renderLayers.length });
    requestAnimationFrame(() => {
      if (mapRef.current !== map || !map.getContainer()?.isConnected) return;
      map.invalidateSize();
      if (initialZoomMode === "fixed") {
        const center = initialCenter ? L.latLng(initialCenter) : bounds.getCenter();
        debugLog("autofit", "set-view", { zoom: initialZoom, center });
        map.setView(center, initialZoom);
      } else {
        debugLog("autofit", "fit-bounds", { bounds: bounds.toBBoxString() });
        map.fitBounds(bounds, { padding: [28, 28] });
      }
      window.setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 0);
    });
  }, [autoFitKey, initialBounds, initialCenter, initialZoom, initialZoomMode, lastAutoFitKeyRef, mapInstanceVersion, mapRef, programmaticMoveRef, renderLayers]);
}

export function useTerraDrawEditor({
  mapRef,
  mapInstanceVersion,
  project,
  selectedLayer,
  drawMode,
  geometryEditingDisabled,
  preview,
  snapEnabled,
  onProjectChange,
  onDrawStatusChange
}: {
  mapRef: MutableRefObject<L.Map | null>;
  mapInstanceVersion: number;
  project: Qgis2webProject;
  selectedLayer?: LayerManifest;
  drawMode: DrawMode;
  geometryEditingDisabled: boolean;
  preview: boolean;
  snapEnabled: boolean;
  onProjectChange: (project: Qgis2webProject, options?: { label?: string; group?: string; coalesceMs?: number }) => void;
  onDrawStatusChange: (status: string) => void;
}) {
  const drawRef = useRef<TerraDraw | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (preview) {
      drawRef.current?.stop();
      drawRef.current = null;
      onDrawStatusChange("Preview mode");
      return;
    }
    if (drawMode === "lasso") {
      drawRef.current?.stop();
      drawRef.current = null;
      onDrawStatusChange("Drag on the map to lasso features in the selected layer.");
      return;
    }
    if (geometryEditingDisabled) {
      drawRef.current?.stop();
      drawRef.current = null;
      onDrawStatusChange("Multi-geometry layer is preview-only. Style, popup, legend, and attributes remain editable.");
      return;
    }
    if (!map || !selectedLayer) return;
    drawRef.current?.stop();
    drawRef.current = null;

    const draw = new TerraDraw({
      adapter: new TerraDrawLeafletAdapter({ lib: L, map }),
      modes: [
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                rotateable: true,
                scaleable: true,
                coordinates: {
                  draggable: true,
                  midpoints: true,
                  deletable: true,
                  snappable: snapOptions(snapEnabled)
                }
              }
            },
            linestring: {
              feature: {
                draggable: true,
                coordinates: {
                  draggable: true,
                  midpoints: true,
                  deletable: true,
                  snappable: snapOptions(snapEnabled)
                }
              }
            },
            point: {
              feature: {
                draggable: true
              }
            }
          }
        }),
        new TerraDrawPointMode(),
        new TerraDrawLineStringMode({ snapping: snapOptions(snapEnabled) }),
        new TerraDrawPolygonMode({ showCoordinatePoints: true, snapping: snapOptions(snapEnabled) }),
        new TerraDrawRectangleMode(),
        new TerraDrawCircleMode()
      ]
    });

    draw.start();
    debugLog("terradraw", "start", { layerId: selectedLayer.id, drawMode, mapInstanceVersion });
    draw.setMode(drawMode === "delete" ? "select" : drawMode);
    debugLog("terradraw", "set-mode", { drawMode: drawMode === "delete" ? "select" : drawMode });
    const editableFeatures = toTerraDrawFeatures(selectedLayer);
    const unsupportedCount = selectedLayer.geojson.features.length - editableFeatures.length;
    if (editableFeatures.length > 0) {
      draw.addFeatures(editableFeatures);
    }
    onDrawStatusChange(
      unsupportedCount > 0
        ? `${editableFeatures.length} simple features editable. ${unsupportedCount} multi features remain preview-only.${snapEnabled ? " Snap is on." : ""}`
        : `${editableFeatures.length} features loaded into geometry editor.${snapEnabled ? " Snap is on." : ""}`
    );
    debugLog("terradraw", "snap-mode", { enabled: snapEnabled, layerId: selectedLayer.id });

    const syncLayer = () => {
      const snapshot = draw.getSnapshot();
      debugLog("terradraw", "sync-layer", { featureCount: snapshot.length, layerId: selectedLayer.id });
      const existingUnsupported = selectedLayer.geojson.features.filter(
        (feature) => !["Point", "LineString", "Polygon"].includes(feature.geometry?.type || "")
      );
      const features = snapshot.map(fromTerraDrawFeature);
      onProjectChange(
        updateLayerGeojson(project, selectedLayer.id, {
          ...selectedLayer.geojson,
          features: [...existingUnsupported, ...features]
        }),
        { label: `Edit ${selectedLayer.displayName} geometry`, group: `geometry:${selectedLayer.id}`, coalesceMs: 600 }
      );
    };

    draw.on("finish", () => {
      debugLog("terradraw", "finish", { layerId: selectedLayer.id });
      syncLayer();
    });
    draw.on("change", () => {
      debugLog("terradraw", "change", { layerId: selectedLayer.id });
      syncLayer();
    });
    drawRef.current = draw;

    return () => {
      draw.stop();
      drawRef.current = null;
    };
  }, [drawMode, geometryEditingDisabled, mapInstanceVersion, mapRef, onDrawStatusChange, onProjectChange, preview, project, selectedLayer, snapEnabled]);

  useEffect(() => {
    if (preview || geometryEditingDisabled) return;
    if (!drawRef.current) return;
    if (drawMode === "lasso") return;
    drawRef.current.setMode(drawMode === "delete" ? "select" : drawMode);
    onDrawStatusChange(drawMode === "delete" ? "Select a feature and press Delete." : `Geometry mode: ${drawMode}${snapEnabled ? " · snap on" : ""}`);
  }, [drawMode, geometryEditingDisabled, onDrawStatusChange, preview, snapEnabled]);
}
