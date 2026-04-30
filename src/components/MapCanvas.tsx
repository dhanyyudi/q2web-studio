import { useEffect, useMemo, useState } from "react";
import { allLegendItems, legendGroupsForLayers } from "../lib/style";
import type { DrawMode, LayerManifest, Qgis2webProject } from "../types/project";
import { LayerControl, LegendPanel, MapFooter, MapHeader } from "./mapCanvasPanels";
import { labelCss, popupCss, visiblePreviewLayers } from "./mapCanvasHelpers";
import { useAutoFit, useBasemap, useGeoJsonLayers, useLeafletMap, useSimplifiedLayers, useTerraDrawEditor } from "./mapCanvasHooks";

type MapCanvasProps = {
  project: Qgis2webProject;
  selectedLayerId: string;
  drawMode: DrawMode;
  geometryEditingDisabled?: boolean;
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
  geometryEditingDisabled = false,
  preview = false,
  showLayerControl = false,
  layerVisibility,
  onLayerVisibilityChange,
  onTileError,
  onProjectChange
}: MapCanvasProps) {
  const { containerRef, mapRef, mapZoom, mapInstanceVersion } = useLeafletMap();
  const [drawStatus, setDrawStatus] = useState("Select, draw, or edit simple geometries.");
  const [legendOpen, setLegendOpen] = useState(!project.legendSettings.collapsed);

  const selectedLayer = useMemo(
    () => project.layers.find((layer) => layer.id === selectedLayerId) || project.layers[0],
    [project.layers, selectedLayerId]
  );
  const previewLayers = useMemo(
    () => visiblePreviewLayers(project.layers, selectedLayerId, project.mapSettings.viewMode),
    [project.layers, project.mapSettings.viewMode, selectedLayerId]
  );
  const visibleLayers = useMemo(
    () => previewLayers.filter((layer) => layerVisibility?.[layer.id] ?? layer.visible),
    [layerVisibility, previewLayers]
  );
  const legendGroups = useMemo(
    () =>
      project.legendSettings.groupByLayer
        ? legendGroupsForLayers(visibleLayers, project.manualLegendItems)
        : [{ id: "all", label: "Layers", items: allLegendItems(visibleLayers, project.manualLegendItems) }],
    [project.legendSettings.groupByLayer, project.manualLegendItems, visibleLayers]
  );
  const simplifiedLayers = useSimplifiedLayers(visibleLayers, mapZoom);
  const renderLayers = useMemo(
    () =>
      visibleLayers.map((layer) => {
        const simplified = simplifiedLayers[layer.id];
        return simplified ? { ...layer, geojson: simplified } : layer;
      }),
    [simplifiedLayers, visibleLayers]
  );
  const autoFitKey = useMemo(
    () =>
      [
        project.mapSettings.viewMode,
        selectedLayerId,
        visibleLayers.map((layer) => `${layer.id}:${layer.visible}`).join("|"),
        project.mapSettings.initialZoomMode,
        project.mapSettings.initialZoom
      ].join("::"),
    [project.mapSettings.initialZoom, project.mapSettings.initialZoomMode, project.mapSettings.viewMode, selectedLayerId, visibleLayers]
  );

  useEffect(() => {
    setLegendOpen(!project.legendSettings.collapsed);
  }, [project.legendSettings.collapsed]);

  useBasemap(mapRef, mapInstanceVersion, project.basemaps, project.mapSettings.basemap, onTileError);
  useGeoJsonLayers(mapRef, mapInstanceVersion, renderLayers, project.textAnnotations);
  useAutoFit(
    mapRef,
    renderLayers,
    autoFitKey,
    project.mapSettings.initialZoomMode,
    project.mapSettings.initialZoom,
    project.mapSettings.initialBounds,
    mapInstanceVersion
  );
  useTerraDrawEditor({
    mapRef,
    mapInstanceVersion,
    project,
    selectedLayer,
    drawMode,
    geometryEditingDisabled,
    preview,
    onProjectChange,
    onDrawStatusChange: setDrawStatus
  });

  const headerPlacementClass = project.branding.showHeader && project.branding.headerPlacement !== "hidden"
    ? `map-shell-header-${project.branding.headerPlacement}`
    : "map-shell-header-hidden";

  return (
    <section className={`map-shell ${headerPlacementClass}`}>
      <MapHeader project={project} />
      <div ref={containerRef} className="map-canvas" />
      <style>{popupCss(project)}</style>
      <style>{labelCss(project.layers)}</style>
      {showLayerControl && (
        <LayerControl layers={previewLayers} layerVisibility={layerVisibility} onLayerVisibilityChange={onLayerVisibilityChange} />
      )}
      {project.legendSettings.enabled && project.legendSettings.placement !== "hidden" && project.legendSettings.placement !== "inside-control" && legendGroups.some((group) => group.items.length > 0) && (
        <LegendPanel groups={legendGroups} open={legendOpen} position={project.legendSettings.position} onOpenChange={setLegendOpen} />
      )}
      {!preview && <div className="draw-status">{drawStatus}</div>}
      <MapFooter project={project} />
    </section>
  );
}

export type { LayerManifest };
