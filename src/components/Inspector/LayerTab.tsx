import { Switch } from "../ui/switch";
import type { LayerManifest } from "../../types/project";
import { fieldNames } from "../../lib/style";
import { RangeNumberField } from "../forms/RangeNumberField";
import { GeometryOpsPanel } from "./GeometryOpsPanel";
import { PanelTitle, SelectField, SwitchLabel, TextInput } from "./controls";
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
      <SelectionToolbar {...props} />
      <section data-testid="layer-section-selected-feature">
        <PanelTitle title="Selected Feature" />
        <SelectedFeaturePanel {...props} />
      </section>
      <section data-testid="layer-section-geometry-ops">
        <PanelTitle title="Geometry Ops" />
        <GeometryOpsPanel
          selectedFeatureData={props.selectedFeatureData}
          selectedGeometryKind={props.selectedGeometryKind}
          selectedLayerHasMultiGeometry={selectedLayerHasMultiGeometry}
          polygonToLineSelectedFeature={props.polygonToLineSelectedFeature}
          convexHullSelectedFeature={props.convexHullSelectedFeature}
          splitLineSelectedFeature={props.splitLineSelectedFeature}
          divideLineSelectedFeature={props.divideLineSelectedFeature}
          simplifySelectedFeature={props.simplifySelectedFeature}
        />
      </section>
      <section data-testid="layer-section-layer-settings">
        <PanelTitle title="Layer Settings" />
        <TextInput label="Layer label" value={selectedLayer.displayName} onChange={(displayName) => patchSelectedLayer({ displayName })} />
        <div className="toggle-grid">
          <SwitchLabel label="Visible" checked={selectedLayer.visible} onCheckedChange={(checked) => patchSelectedLayer({ visible: checked })} />
          <SwitchLabel label="Popup" checked={selectedLayer.popupEnabled} onCheckedChange={(checked) => patchSelectedLayer({ popupEnabled: checked })} />
          <SwitchLabel label="Legend" checked={selectedLayer.legendEnabled} onCheckedChange={(checked) => patchSelectedLayer({ legendEnabled: checked })} />
          <SwitchLabel label="Layer toggle" checked={selectedLayer.showInLayerControl} onCheckedChange={(checked) => patchSelectedLayer({ showInLayerControl: checked })} />
        </div>
      </section>
      <section data-testid="layer-section-labels">
        <PanelTitle title="Labels" />
        <div className="toggle-grid">
          <SwitchLabel label="Show labels" checked={layerLabel.enabled} onCheckedChange={(checked) => patchSelectedLayer({ label: { ...layerLabel, enabled: checked } })} />
          <SwitchLabel label="Permanent" checked={layerLabel.permanent} onCheckedChange={(checked) => patchSelectedLayer({ label: { ...layerLabel, permanent: checked } })} />
        </div>
        <SelectField label="Label field" value={layerLabel.field} onChange={(field) => patchSelectedLayer({ label: { ...layerLabel, field, htmlTemplate: `{{${field}}}` } })} options={fieldNames(selectedLayer).map((field) => ({ value: field, label: field }))} />
        <RangeNumberField label="Label offset X" value={layerLabel.offset[0]} min={-40} max={40} step={1} unit="px" onChange={(offsetX) => patchSelectedLayer({ label: { ...layerLabel, offset: [offsetX, layerLabel.offset[1]] } })} />
        <RangeNumberField label="Label offset Y" value={layerLabel.offset[1]} min={-40} max={40} step={1} unit="px" onChange={(offsetY) => patchSelectedLayer({ label: { ...layerLabel, offset: [layerLabel.offset[0], offsetY] } })} />
      </section>
    </>
  );
}
