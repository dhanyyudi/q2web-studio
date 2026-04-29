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
import { ChevronDown, ChevronRight, Layers3 } from "lucide-react";
import { allLegendItems, legendGroupsForLayers } from "../lib/style";
import type { LegendGroup } from "../lib/style";
import { styleForFeature } from "../lib/style";
import { shouldSimplifyLayer, simplifyLayersForPreview } from "../lib/simplifyClient";
import type { BasemapId, DrawMode, LayerManifest, LegendItem, Qgis2webProject, TextAnnotation } from "../types/project";
import { updateLayerGeojson } from "../lib/projectUpdates";

type MapCanvasProps = {
  project: Qgis2webProject;
  selectedLayerId: string;
  drawMode: DrawMode;
  preview?: boolean;
  showLayerControl?: boolean;
  layerVisibility?: Record<string, boolean>;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onTileError?: (message: string) => void;
  onProjectChange: (project: Qgis2webProject) => void;
};

export function MapCanvas({
  project,
  selectedLayerId,
  drawMode,
  preview = false,
  showLayerControl = false,
  layerVisibility,
  onLayerVisibilityChange,
  onTileError,
  onProjectChange
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const basemapRef = useRef<L.TileLayer | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const tileErrorShownRef = useRef(false);
  const [drawStatus, setDrawStatus] = useState("Select, draw, or edit simple geometries.");
  const [legendOpen, setLegendOpen] = useState(!project.legendSettings.collapsed);
  const [mapZoom, setMapZoom] = useState(12);
  const [simplifiedLayers, setSimplifiedLayers] = useState<Record<string, FeatureCollection>>({});
  const selectedLayer = useMemo(
    () => project.layers.find((layer) => layer.id === selectedLayerId) || project.layers[0],
    [project.layers, selectedLayerId]
  );
  const visibleLayers = useMemo(
    () =>
      visiblePreviewLayers(project.layers, selectedLayerId, project.mapSettings.viewMode).filter(
        (layer) => layerVisibility?.[layer.id] ?? layer.visible
      ),
    [layerVisibility, project.layers, project.mapSettings.viewMode, selectedLayerId]
  );
  const legendGroups = useMemo(
    () =>
      project.legendSettings.groupByLayer
        ? legendGroupsForLayers(visibleLayers, project.manualLegendItems)
        : [{ id: "all", label: "Layers", items: allLegendItems(visibleLayers, project.manualLegendItems) }],
    [project.legendSettings.groupByLayer, project.manualLegendItems, visibleLayers]
  );
  const renderLayers = useMemo(
    () =>
      visibleLayers.map((layer) => {
        const simplified = simplifiedLayers[layer.id];
        return simplified ? { ...layer, geojson: simplified } : layer;
      }),
    [simplifiedLayers, visibleLayers]
  );

  useEffect(() => {
    setLegendOpen(!project.legendSettings.collapsed);
  }, [project.legendSettings.collapsed]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const updateZoom = () => setMapZoom(map.getZoom());
    map.on("zoomend", updateZoom);
    mapRef.current = map;
    return () => {
      map.off("zoomend", updateZoom);
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candidates = visibleLayers.filter((layer) => shouldSimplifyLayer(layer, mapZoom));
    if (candidates.length === 0) {
      setSimplifiedLayers({});
      return;
    }
    let cancelled = false;
    simplifyLayersForPreview(candidates, mapZoom)
      .then((next) => {
        if (!cancelled) setSimplifiedLayers(next);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Preview simplification failed", error);
          setSimplifiedLayers({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mapZoom, visibleLayers]);

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

    renderLayers.forEach((layer) => {
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

    const bounds = projectBounds(renderLayers);
    if (bounds && project.mapSettings.initialZoomMode === "fixed") {
      map.setView(bounds.getCenter(), project.mapSettings.initialZoom);
    } else if (bounds) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }

    return () => {
      layerGroup.remove();
    };
  }, [project.mapSettings.initialZoom, project.mapSettings.initialZoomMode, project.textAnnotations, renderLayers]);

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
      {showLayerControl && (
        <LayerControl
          layers={visiblePreviewLayers(project.layers, selectedLayerId, project.mapSettings.viewMode)}
          layerVisibility={layerVisibility}
          onLayerVisibilityChange={onLayerVisibilityChange}
        />
      )}
      {project.legendSettings.enabled && legendGroups.some((group) => group.items.length > 0) && (
        <LegendPanel
          groups={legendGroups}
          open={legendOpen}
          position={project.legendSettings.position}
          onOpenChange={setLegendOpen}
        />
      )}
      {!preview && <div className="draw-status">{drawStatus}</div>}
      {project.branding.showFooter && <div className="map-footer-preview">{project.branding.footer}</div>}
    </section>
  );
}

function LayerControl({
  layers,
  layerVisibility,
  onLayerVisibilityChange
}: {
  layers: LayerManifest[];
  layerVisibility?: Record<string, boolean>;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
}) {
  const toggleableLayers = layers.filter((layer) => layer.showInLayerControl);
  if (toggleableLayers.length === 0) return null;
  return (
    <aside className="layer-toggle-preview">
      <h3>
        <Layers3 size={15} /> Layers
      </h3>
      {toggleableLayers.map((layer) => {
        const checked = layerVisibility?.[layer.id] ?? layer.visible;
        return (
          <label key={layer.id}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onLayerVisibilityChange?.(layer.id, event.target.checked)}
            />
            <span>{layer.displayName}</span>
          </label>
        );
      })}
    </aside>
  );
}

function LegendPanel({
  groups,
  open,
  position,
  onOpenChange
}: {
  groups: LegendGroup[];
  open: boolean;
  position: Qgis2webProject["legendSettings"]["position"];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <aside className={`legend-preview legend-${position} ${open ? "" : "collapsed"}`}>
      <button type="button" className="legend-toggle" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span>Legenda</span>
      </button>
      {open && (
        <div className="legend-groups">
          {groups.map((group) => (
            <div className="legend-group" key={group.id}>
              <h4>{group.label}</h4>
              {group.items.map((item) => (
                <LegendRow key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function createBasemap(basemap: BasemapId): L.TileLayer | null {
  if (basemap === "none") return null;
  if (basemap === "osm-hot") {
    return L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors, Tiles style by HOT",
      crossOrigin: "anonymous"
    });
  }
  if (basemap === "esri-imagery") {
    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
      crossOrigin: "anonymous"
    });
  }
  if (basemap === "esri-topo") {
    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
      crossOrigin: "anonymous"
    });
  }
  if (basemap === "esri-streets") {
    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
      crossOrigin: "anonymous"
    });
  }
  if (basemap === "stadia-terrain") {
    return L.tileLayer("https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; Stadia Maps &copy; Stamen Design &copy; OpenStreetMap contributors",
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
  const collections = layers.map((layer) => layer.geojson);
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
