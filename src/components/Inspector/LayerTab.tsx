import type { LayerManifest } from "../../types/project";
import { fieldNames } from "../../lib/style";
import { PanelTitle, RangeInput, SelectField, TextInput } from "./controls";
import { GeometryOpsPanel } from "./GeometryOpsPanel";
import { SelectedFeaturePanel, type SelectedFeaturePanelProps } from "./SelectedFeaturePanel";
import { SelectionToolbar, type SelectionToolbarProps } from "./SelectionToolbar";

export type LayerTabProps = SelectedFeaturePanelProps & SelectionToolbarProps & {
  selectedLayer: LayerManifest;
  selectedLayerHasMultiGeometry: boolean;
  patchSelectedLayer: (patch: Partial<LayerManifest>) => void;
  ensureLayerLabel: (layer: LayerManifest) => NonNullable<LayerManifest["label"]>;
};

export function LayerTab(props: LayerTabProps) {
  const { selectedLayer, selectedLayerHasMultiGeometry, patchSelectedLayer, ensureLayerLabel } = props;
  const layerLabel = ensureLayerLabel(selectedLayer);

  return (
    <>
      <PanelTitle title="Layer Editor" />
      <TextInput label="Layer label" value={selectedLayer.displayName} onChange={(displayName) => patchSelectedLayer({ displayName })} />
      <PanelTitle title="Selected Feature" />
      <SelectedFeaturePanel {...props} />
      <SelectionToolbar {...props} />
      <GeometryOpsPanel selectedLayerHasMultiGeometry={selectedLayerHasMultiGeometry} />
      <div className="toggle-grid">
        <label><input type="checkbox" checked={selectedLayer.visible} onChange={(event) => patchSelectedLayer({ visible: event.target.checked })} />Visible</label>
        <label><input type="checkbox" checked={selectedLayer.popupEnabled} onChange={(event) => patchSelectedLayer({ popupEnabled: event.target.checked })} />Popup</label>
        <label><input type="checkbox" checked={selectedLayer.legendEnabled} onChange={(event) => patchSelectedLayer({ legendEnabled: event.target.checked })} />Legend</label>
        <label><input type="checkbox" checked={selectedLayer.showInLayerControl} onChange={(event) => patchSelectedLayer({ showInLayerControl: event.target.checked })} />Layer toggle</label>
      </div>
      <PanelTitle title="Labels" />
      <div className="toggle-grid">
        <label><input type="checkbox" checked={layerLabel.enabled} onChange={(event) => patchSelectedLayer({ label: { ...layerLabel, enabled: event.target.checked } })} />Show labels</label>
        <label><input type="checkbox" checked={layerLabel.permanent} onChange={(event) => patchSelectedLayer({ label: { ...layerLabel, permanent: event.target.checked } })} />Permanent</label>
      </div>
      <SelectField label="Label field" value={layerLabel.field} onChange={(field) => patchSelectedLayer({ label: { ...layerLabel, field, htmlTemplate: `{{${field}}}` } })} options={fieldNames(selectedLayer).map((field) => ({ value: field, label: field }))} />
      <RangeInput label="Label offset X" value={layerLabel.offset[0]} min={-40} max={40} step={1} onChange={(offsetX) => patchSelectedLayer({ label: { ...layerLabel, offset: [offsetX, layerLabel.offset[1]] } })} />
      <RangeInput label="Label offset Y" value={layerLabel.offset[1]} min={-40} max={40} step={1} onChange={(offsetY) => patchSelectedLayer({ label: { ...layerLabel, offset: [layerLabel.offset[0], offsetY] } })} />
    </>
  );
}
