import { RangeNumberField } from "../forms/RangeNumberField";
import { PanelTitle, TextInput } from "./controls";
import type { ProjectLayer, RasterImageLayer, RasterPmtilesLayer, RasterWmsLayer } from "../../types/project";

type RasterLayer = RasterImageLayer | RasterWmsLayer | RasterPmtilesLayer;

type RasterLayerTabProps = {
  selectedLayer: RasterLayer;
  updateRasterLayer: (layerId: string, patch: Partial<RasterLayer>) => void;
};

export function RasterLayerTab({ selectedLayer, updateRasterLayer }: RasterLayerTabProps) {
  return (
    <section data-testid="raster-layer-tab">
      <PanelTitle title="Raster Settings" />
      <TextInput label="Layer label" value={selectedLayer.displayName} onChange={(displayName) => updateRasterLayer(selectedLayer.id, { displayName })} />
      <div className="toggle-grid">
        <label><input type="checkbox" checked={selectedLayer.visible} onChange={(event) => updateRasterLayer(selectedLayer.id, { visible: event.target.checked })} /><span>Visible</span></label>
        <label><input type="checkbox" checked={selectedLayer.showInLayerControl} onChange={(event) => updateRasterLayer(selectedLayer.id, { showInLayerControl: event.target.checked })} /><span>Layer toggle</span></label>
      </div>
      <RangeNumberField label="Opacity" value={selectedLayer.opacity} min={0} max={1} step={0.05} onChange={(opacity) => updateRasterLayer(selectedLayer.id, { opacity })} />
      <div className="field">
        <span>Raster source</span>
        <input value={rasterSourceSummary(selectedLayer)} readOnly />
      </div>
    </section>
  );
}

function rasterSourceSummary(layer: RasterLayer): string {
  if (layer.kind === "raster-image") return layer.imagePath;
  if (layer.kind === "raster-wms") return `${layer.url} · ${layer.layersParam}`;
  return layer.url;
}

export function isRasterLayer(layer: ProjectLayer | undefined): layer is RasterLayer {
  return Boolean(layer && (layer.kind === "raster-image" || layer.kind === "raster-wms" || layer.kind === "raster-pmtiles"));
}
