import { useEffect, useMemo, useState } from "react";
import type { Polygon } from "geojson";
import { allLegendItems, legendGroupsForLayers } from "../lib/style";
import { isVectorLayer } from "../lib/rasterParsing";
import type { DrawMode, LayerManifest, LegendPlacement, LegendPosition, Qgis2webProject, SelectedFeatureRef } from "../types/project";
import { LayerControl, LegendPanel, MapFooter, MapHeader, SidebarPanel, WelcomeOverlay } from "./mapCanvasPanels";
import { labelCss, popupCss, visiblePreviewLayers } from "./mapCanvasHelpers";
import { useAutoFit, useBasemap, useGeoJsonLayers, useLassoSelection, useLeafletMap, useSimplifiedLayers, useTerraDrawEditor } from "./mapCanvasHooks";

function legendPlacementToPosition(placement: LegendPlacement): LegendPosition {
  switch (placement) {
    case "floating-top-left":
      return "top-left";
    case "floating-top-right":
      return "top-right";
    case "floating-bottom-left":
      return "bottom-left";
    case "floating-bottom-right":
    case "inside-control":
    case "hidden":
    default:
      return "bottom-right";
  }
}

type MapCanvasProps = {
  project: Qgis2webProject;
  selectedLayerId: string;
  drawMode: DrawMode;
  snapEnabled?: boolean;
  geometryEditingDisabled?: boolean;
  lassoSelectionEnabled?: boolean;
  preview?: boolean;
  showLayerControl?: boolean;
  layerVisibility?: Record<string, boolean>;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onTileError?: (message: string) => void;
  onProjectChange: (project: Qgis2webProject, options?: { label?: string; group?: string; coalesceMs?: number }) => void;
  selectedFeature: SelectedFeatureRef | null;
  selectedFeatureIds?: string[];
  onSelectedFeatureChange: (selection: SelectedFeatureRef | null) => void;
  onLassoComplete?: (polygon: Polygon) => void;
};

export function MapCanvas({
  project,
  selectedLayerId,
  drawMode,
  snapEnabled = false,
  geometryEditingDisabled = false,
  lassoSelectionEnabled = false,
  preview = false,
  showLayerControl = true,
  layerVisibility,
  onLayerVisibilityChange,
  onTileError,
  onProjectChange,
  selectedFeature,
  selectedFeatureIds = [],
  onSelectedFeatureChange,
  onLassoComplete
}: MapCanvasProps) {
  const { containerRef, mapRef, mapZoom, mapInstanceVersion } = useLeafletMap();
  const [drawStatus, setDrawStatus] = useState("Select, draw, or edit simple geometries.");
  const [legendOpen, setLegendOpen] = useState(!project.legendSettings.collapsed);

  const vectorLayers = useMemo(() => project.layers.filter(isVectorLayer), [project.layers]);
  const selectedLayer = useMemo(
    () => vectorLayers.find((layer) => layer.id === selectedLayerId) || vectorLayers[0],
    [selectedLayerId, vectorLayers]
  );
  const previewLayers = useMemo(
    () => visiblePreviewLayers(vectorLayers, selectedLayerId, project.mapSettings.viewMode),
    [vectorLayers, project.mapSettings.viewMode, selectedLayerId]
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
        project.mapSettings.viewMode === "selected" ? selectedLayerId : "all",
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
  useGeoJsonLayers(mapRef, mapInstanceVersion, renderLayers, project.textAnnotations, project.popupSettings, selectedFeature, selectedLayerId, selectedFeatureIds, onSelectedFeatureChange);
  useLassoSelection({
    mapRef,
    mapInstanceVersion,
    drawMode,
    lassoSelectionEnabled,
    preview,
    onDrawStatusChange: setDrawStatus,
    onLassoComplete: onLassoComplete || (() => undefined)
  });
  useAutoFit(
    mapRef,
    renderLayers,
    autoFitKey,
    project.mapSettings.initialZoomMode,
    project.mapSettings.initialZoom,
    project.mapSettings.initialBounds,
    project.mapSettings.initialCenter,
    mapInstanceVersion
  );
  useTerraDrawEditor({
    mapRef,
    mapInstanceVersion,
    project,
    selectedLayer,
    drawMode,
    snapEnabled,
    geometryEditingDisabled,
    preview,
    onProjectChange,
    onDrawStatusChange: setDrawStatus
  });

  const headerPlacementClass = project.branding.showHeader && project.branding.headerPlacement !== "hidden"
    ? `map-shell-header-${project.branding.headerPlacement}`
    : "map-shell-header-hidden";
  const sidebarClass = project.sidebar.enabled ? `map-shell-sidebar-${project.sidebar.side}` : "map-shell-sidebar-hidden";

  return (
    <section className={`map-shell ${headerPlacementClass} ${sidebarClass}`}>
      <MapHeader project={project} />
      <div ref={containerRef} className="map-canvas" />
      <SidebarPanel project={project} />
      <WelcomeOverlay project={project} />
      <style>{popupCss(project)}</style>
      <style>{labelCss(vectorLayers)}</style>
      {showLayerControl && (
        <LayerControl
          layers={previewLayers}
          layerVisibility={layerVisibility}
          mode={project.layerControlSettings.mode || project.mapSettings.layerControlMode}
          settings={project.layerControlSettings}
          legendGroups={legendGroups}
          showLegendInside={project.legendSettings.enabled && project.legendSettings.placement === "inside-control"}
          legendOpen={legendOpen}
          onLayerVisibilityChange={onLayerVisibilityChange}
          onLegendOpenChange={setLegendOpen}
        />
      )}
      {project.legendSettings.enabled && project.legendSettings.placement !== "hidden" && project.legendSettings.placement !== "inside-control" && legendGroups.some((group) => group.items.length > 0) && (
        <LegendPanel groups={legendGroups} open={legendOpen} position={legendPlacementToPosition(project.legendSettings.placement)} onOpenChange={setLegendOpen} />
      )}
      {!preview && <div className="draw-status">{drawStatus}</div>}
      <MapFooter project={project} />
    </section>
  );
}

export type { LayerManifest };
