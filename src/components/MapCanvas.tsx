import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
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
import type { DrawMode, LayerManifest, Qgis2webProject, TextAnnotation } from "../types/project";
import { updateLayerGeojson } from "../lib/projectUpdates";

type MapCanvasProps = {
  project: Qgis2webProject;
  selectedLayerId: string;
  drawMode: DrawMode;
  onProjectChange: (project: Qgis2webProject) => void;
};

export function MapCanvas({ project, selectedLayerId, drawMode, onProjectChange }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
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
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OpenStreetMap"
    }).addTo(map);
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
    const layerGroup = L.layerGroup().addTo(map);

    project.layers.forEach((layer) => {
      if (!layer.visible) return;
      const geoLayer = L.geoJSON(layer.geojson, {
        style: (feature) => styleForFeature(layer, feature as Feature),
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            ...styleForFeature(layer, feature as Feature),
            radius: layer.style.pointRadius
          }),
        onEachFeature: (feature, leafletLayer) => {
          if (!layer.popupEnabled) return;
          leafletLayer.bindPopup(buildPopup(layer, feature as Feature));
        }
      });
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

    const bounds = projectBounds(project.layers);
    if (bounds) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }

    return () => {
      layerGroup.remove();
    };
  }, [project.layers, project.textAnnotations]);

  useEffect(() => {
    const map = mapRef.current;
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
  }, [drawMode, selectedLayerId]);

  useEffect(() => {
    if (!drawRef.current) return;
    drawRef.current.setMode(drawMode === "delete" ? "select" : drawMode);
    setDrawStatus(drawMode === "delete" ? "Select a feature and press Delete." : `Geometry mode: ${drawMode}`);
  }, [drawMode]);

  return (
    <section className="map-shell">
      <div className="map-header-preview" style={{ background: project.theme.accent }}>
        <strong>{project.branding.title}</strong>
        <span>{project.branding.subtitle}</span>
      </div>
      <div ref={containerRef} className="map-canvas" />
      <aside className="legend-preview">
        <h3>Legenda</h3>
        {project.layers.flatMap((layer) =>
          layer.style.categories.length > 0
            ? layer.style.categories
                .filter((category) => category.visible)
                .map((category) => (
                  <div className="legend-row" key={`${layer.id}-${category.value}`}>
                    <span style={{ background: category.fillColor, borderColor: category.strokeColor }} />
                    {category.label || category.value}
                  </div>
                ))
            : [
                <div className="legend-row" key={layer.id}>
                  <span style={{ background: layer.style.fillColor, borderColor: layer.style.strokeColor }} />
                  {layer.displayName}
                </div>
              ]
        )}
        {project.manualLegendItems.map((item) => (
          <div className="legend-row" key={item.id}>
            <span style={{ background: item.fillColor, borderColor: item.strokeColor }} />
            {item.label}
          </div>
        ))}
      </aside>
      <div className="draw-status">{drawStatus}</div>
      {project.branding.showFooter && <div className="map-footer-preview">{project.branding.footer}</div>}
    </section>
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
