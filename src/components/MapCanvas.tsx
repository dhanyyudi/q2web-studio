import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import bbox from "@turf/bbox";
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode
} from "terra-draw";
import type { GeoJSONStoreFeatures } from "terra-draw";
import { TerraDrawLeafletAdapter } from "terra-draw-leaflet-adapter";
import type { Feature, FeatureCollection } from "geojson";
import { styleForFeature } from "../lib/style";
import { allLegendItems } from "../lib/style";
import type { BasemapId, DrawMode, LayerManifest, LegendItem, Qgis2webProject, TextAnnotation } from "../types/project";
import { updateLayerGeojson } from "../lib/projectUpdates";

type MapCanvasProps = {
  project: Qgis2webProject;
  selectedLayerId: string;
  drawMode: DrawMode;
  preview?: boolean;
  onTileError?: (message: string) => void;
  onProjectChange: (project: Qgis2webProject) => void;
};

export function MapCanvas({ project, selectedLayerId, drawMode, preview = false, onTileError, onProjectChange }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const basemapRef = useRef<L.TileLayer | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const tileErrorShownRef = useRef(false);
  const [drawStatus, setDrawStatus] = useState("Select, draw, or edit simple geometries.");
  const selectedLayer = useMemo(
    () => project.layers.find((layer) => layer.id === selectedLayerId) || project.layers[0],
    [project.layers, selectedLayerId]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    basemapRef.current?.remove();
    basemapRef.current = null;
    tileErrorShownRef.current = false;
    const basemap = createBasemap(project.mapSettings.basemap);
    if (basemap) {
      basemap.on("tileerror", () => {
        if (tileErrorShownRef.current) return;
        tileErrorShownRef.current = true;
        onTileError?.("Basemap failed to load. Check your connection or pick a different basemap.");
      });
      basemap.addTo(map);
      basemapRef.current = basemap;
    }
  }, [onTileError, project.mapSettings.basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layerGroup = L.layerGroup().addTo(map);

    visiblePreviewLayers(project.layers, selectedLayerId, project.mapSettings.viewMode).forEach((layer) => {
      if (!layer.visible) return;
      const clusterPoints = shouldClusterLayer(layer);
      const geoLayer = L.geoJSON(layer.geojson, {
        style: (feature) => styleForFeature(layer, feature as Feature),
        pointToLayer: (feature, latlng) => {
          if (clusterPoints) {
            return L.marker(latlng, { icon: pointClusterIcon(layer, feature as Feature) });
          }
          return L.circleMarker(latlng, {
            ...styleForFeature(layer, feature as Feature),
            radius: layer.style.pointRadius
          });
        },
        onEachFeature: (feature, leafletLayer) => {
          if (!layer.popupEnabled) return;
          leafletLayer.bindPopup(buildPopup(layer, feature as Feature));
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

    project.textAnnotations.forEach((annotation) => {
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

    const bounds = projectBounds(visiblePreviewLayers(project.layers, selectedLayerId, project.mapSettings.viewMode));
    if (bounds) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }

    return () => {
      layerGroup.remove();
    };
  }, [project.layers, project.textAnnotations, project.mapSettings.viewMode, selectedLayerId]);

  useEffect(() => {
    const map = mapRef.current;
    if (preview) {
      drawRef.current?.stop();
      drawRef.current = null;
      setDrawStatus("Preview mode");
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
                  deletable: true
                }
              }
            },
            linestring: {
              feature: {
                draggable: true,
                coordinates: {
                  draggable: true,
                  midpoints: true,
                  deletable: true
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
        new TerraDrawLineStringMode(),
        new TerraDrawPolygonMode({ showCoordinatePoints: true }),
        new TerraDrawRectangleMode(),
        new TerraDrawCircleMode()
      ]
    });

    draw.start();
    draw.setMode(drawMode === "delete" ? "select" : drawMode);
    const editableFeatures = toTerraDrawFeatures(selectedLayer);
    const unsupportedCount = selectedLayer.geojson.features.length - editableFeatures.length;
    if (editableFeatures.length > 0) {
      draw.addFeatures(editableFeatures);
    }
    setDrawStatus(
      unsupportedCount > 0
        ? `${editableFeatures.length} simple features editable. ${unsupportedCount} multi features remain preview-only.`
        : `${editableFeatures.length} features loaded into geometry editor.`
    );

    const syncLayer = () => {
      const snapshot = draw.getSnapshot();
      const existingUnsupported = selectedLayer.geojson.features.filter(
        (feature) => !["Point", "LineString", "Polygon"].includes(feature.geometry?.type || "")
      );
      const features = snapshot.map(fromTerraDrawFeature);
      onProjectChange(
        updateLayerGeojson(project, selectedLayer.id, {
          ...selectedLayer.geojson,
          features: [...existingUnsupported, ...features]
        })
      );
    };

    draw.on("finish", syncLayer);
    draw.on("change", syncLayer);
    drawRef.current = draw;

    return () => {
      draw.stop();
      drawRef.current = null;
    };
  }, [drawMode, preview, selectedLayerId]);

  useEffect(() => {
    if (preview) return;
    if (!drawRef.current) return;
    drawRef.current.setMode(drawMode === "delete" ? "select" : drawMode);
    setDrawStatus(drawMode === "delete" ? "Select a feature and press Delete." : `Geometry mode: ${drawMode}`);
  }, [drawMode, preview]);

  return (
    <section className="map-shell">
      {project.branding.showHeader && (
        <div
          className={`map-header-preview logo-${project.branding.logoPlacement}`}
          style={{
            background: project.theme.accent,
            minHeight: project.theme.headerHeight,
            borderRadius: project.theme.radius,
            boxShadow: `0 ${Math.max(8, project.theme.shadow)}px ${Math.max(16, project.theme.shadow * 1.8)}px rgba(0, 0, 0, 0.22)`
          }}
        >
          {project.branding.logoPath && project.branding.logoPlacement !== "hidden" && <img src={project.branding.logoPath} alt="" />}
          <div>
            <strong>{project.branding.title}</strong>
            <span>{project.branding.subtitle}</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="map-canvas" />
      <style>{popupCss(project)}</style>
      <aside className="legend-preview">
        <h3>Legenda</h3>
        {allLegendItems(visiblePreviewLayers(project.layers, selectedLayerId, project.mapSettings.viewMode), project.manualLegendItems).map((item) => (
          <LegendRow key={item.id} item={item} />
        ))}
      </aside>
      {!preview && <div className="draw-status">{drawStatus}</div>}
      {project.branding.showFooter && <div className="map-footer-preview">{project.branding.footer}</div>}
    </section>
  );
}

function createBasemap(basemap: BasemapId): L.TileLayer | null {
  if (basemap === "none") return null;
  if (basemap === "esri-imagery") {
    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
      crossOrigin: "anonymous"
    });
  }
  if (basemap === "carto-voyager") {
    return L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      crossOrigin: "anonymous"
    });
  }
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "OpenStreetMap",
    crossOrigin: "anonymous"
  });
}

function visiblePreviewLayers(layers: LayerManifest[], selectedLayerId: string, viewMode: string): LayerManifest[] {
  if (viewMode === "selected") {
    return layers.filter((layer) => layer.id === selectedLayerId);
  }
  return layers;
}

function shouldClusterLayer(layer: LayerManifest): boolean {
  return layer.geometryType.includes("Point") && layer.geojson.features.length > 500;
}

function pointClusterIcon(layer: LayerManifest, feature: Feature): L.DivIcon {
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

function LegendRow({ item }: { item: LegendItem }) {
  return (
    <div className={`legend-row symbol-${item.symbolType}`}>
      <span
        style={{
          background: item.symbolType === "line" ? "transparent" : item.fillColor,
          borderColor: item.strokeColor,
          borderTopWidth: item.symbolType === "line" ? Math.max(2, item.strokeWidth) : undefined,
          borderStyle: item.dashArray ? "dashed" : "solid"
        }}
      />
      {item.label}
    </div>
  );
}

function buildPopup(layer: LayerManifest, feature: Feature): string {
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

function popupCss(project: Qgis2webProject): string {
  const popup = project.popupSettings;
  const border = popup.style === "minimal" ? "0" : `1px solid ${popup.accentColor}`;
  const headerBg = popup.style === "compact" ? "transparent" : colorMix(popup.accentColor, "#ffffff", 0.09);
  return `
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
    .studio-popup {
      border-collapse: collapse;
      min-width: 210px;
      max-width: 340px;
      font: 12px Inter, Segoe UI, Arial, sans-serif;
    }
    .studio-popup th,
    .studio-popup td {
      border: 1px solid rgba(82, 103, 113, 0.18);
      padding: ${popup.style === "compact" ? "5px 7px" : "7px 9px"};
      vertical-align: top;
    }
    .studio-popup th {
      width: 42%;
      background: ${headerBg};
      color: ${popup.labelColor};
      font-weight: 750;
      text-align: left;
    }
    .studio-popup strong {
      color: ${popup.accentColor};
    }
  `;
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

function projectBounds(layers: LayerManifest[]): L.LatLngBounds | null {
  const collections = layers.filter((layer) => layer.visible).map((layer) => layer.geojson);
  if (collections.length === 0) return null;
  const box = bbox({
    type: "FeatureCollection",
    features: collections.flatMap((collection) => collection.features)
  } as FeatureCollection);
  if (box.some((value) => !Number.isFinite(value))) return null;
  return L.latLngBounds([box[1], box[0]], [box[3], box[2]]);
}

function toTerraDrawFeatures(layer: LayerManifest): GeoJSONStoreFeatures[] {
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

function fromTerraDrawFeature(feature: ReturnType<TerraDraw["getSnapshot"]>[number]): Feature {
  const properties = { ...(feature.properties || {}) };
  delete properties.mode;
  return {
    type: "Feature",
    id: feature.id,
    properties,
    geometry: feature.geometry
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
