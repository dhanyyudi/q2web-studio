import type { LayerManifest } from "../../types/project";
import { TextInput } from "./controls";

export type SelectedFeaturePanelProps = {
  selectedLayer: LayerManifest;
  selectedFeatureData: { layer: LayerManifest; feature: GeoJSON.Feature } | null;
  selectedFeatureTitle: (layer: LayerManifest, feature: GeoJSON.Feature) => string;
  selectedGeometryKind: "point" | "line" | "polygon" | "unknown";
  clearSelectedFeature: () => void;
  bufferSelectedFeature: () => void;
  mergeSelectedLayer: () => void;
  updateSelectedFeatureField: (field: string, value: string) => void;
  removeSelectedFeatureProperty: (field: string) => void;
  newFeaturePropertyKey: string;
  setNewFeaturePropertyKey: (value: string) => void;
  newFeaturePropertyValue: string;
  setNewFeaturePropertyValue: (value: string) => void;
  addSelectedFeatureProperty: () => void;
  polygonToLineSelectedFeature: () => void;
  convexHullSelectedFeature: () => void;
  splitLineSelectedFeature: () => void;
  divideLineSelectedFeature: () => void;
  simplifySelectedFeature: () => void;
};

export function SelectedFeaturePanel(props: SelectedFeaturePanelProps) {
  const {
    selectedLayer,
    selectedFeatureData,
    selectedFeatureTitle,
    selectedGeometryKind,
    clearSelectedFeature,
    bufferSelectedFeature,
    mergeSelectedLayer,
    updateSelectedFeatureField,
    removeSelectedFeatureProperty,
    newFeaturePropertyKey,
    setNewFeaturePropertyKey,
    newFeaturePropertyValue,
    setNewFeaturePropertyValue,
    addSelectedFeatureProperty,
    polygonToLineSelectedFeature,
    convexHullSelectedFeature,
    splitLineSelectedFeature,
    divideLineSelectedFeature,
    simplifySelectedFeature
  } = props;

  if (!selectedFeatureData || selectedFeatureData.layer.id !== selectedLayer.id) {
    return <div className="editor-note">Select a feature from the map or attribute table to edit its properties.</div>;
  }

  return (
    <div className="selected-feature-panel">
      <div className="selected-feature-meta">
        <strong data-testid="selected-feature-title" title={selectedFeatureTitle(selectedFeatureData.layer, selectedFeatureData.feature)}>{selectedFeatureTitle(selectedFeatureData.layer, selectedFeatureData.feature)}</strong>
        <div className="dialog-actions">
          <button type="button" className="btn compact" onClick={bufferSelectedFeature}>Buffer</button>
          <button type="button" className="btn compact" onClick={mergeSelectedLayer} disabled={selectedGeometryKind !== "polygon"}>Merge layer</button>
          <button type="button" className="btn compact" onClick={clearSelectedFeature}>Clear</button>
        </div>
      </div>
      <div className="feature-property-list">
        {Object.keys(selectedFeatureData.feature.properties || {}).filter((field) => field !== "__q2ws_id").map((field) => (
          <div className="feature-property-row" key={field}>
            <TextInput label={field} value={String(selectedFeatureData.feature.properties?.[field] ?? "")} onChange={(value) => updateSelectedFeatureField(field, value)} />
            <button type="button" className="btn compact danger" onClick={() => removeSelectedFeatureProperty(field)}>Delete</button>
          </div>
        ))}
      </div>
      <div className="feature-property-add">
        <TextInput label="New property key" value={newFeaturePropertyKey} onChange={setNewFeaturePropertyKey} />
        <TextInput label="Value" value={newFeaturePropertyValue} onChange={setNewFeaturePropertyValue} />
        <button type="button" className="btn compact" onClick={addSelectedFeatureProperty}>Add to feature</button>
      </div>
      <div className="selected-feature-actions">
        <button type="button" className="btn compact" onClick={polygonToLineSelectedFeature}>Polygon to line</button>
        <button type="button" className="btn compact" onClick={convexHullSelectedFeature}>Convex hull</button>
        <button type="button" className="btn compact" onClick={splitLineSelectedFeature} disabled={!selectedFeatureData.layer.geometryType.includes("Line")}>Split line</button>
        <button type="button" className="btn compact" onClick={divideLineSelectedFeature} disabled={!selectedFeatureData.layer.geometryType.includes("Line")}>Divide line</button>
        <button type="button" className="btn compact" onClick={simplifySelectedFeature}>Simplify selected feature</button>
      </div>
    </div>
  );
}
