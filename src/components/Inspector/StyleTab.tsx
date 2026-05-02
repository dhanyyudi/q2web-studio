import type { LayerManifest } from "../../types/project";
import { fieldNames } from "../../lib/style";
import { ColorInput, PanelTitle, RangeInput, SelectField, TextInput, type GeometryKind } from "./controls";

export type StyleTabProps = {
  selectedLayer: LayerManifest;
  selectedGeometryKind: GeometryKind;
  patchSelectedLayer: (patch: Partial<LayerManifest>) => void;
};

export function StyleTab({ selectedLayer, selectedGeometryKind, patchSelectedLayer }: StyleTabProps) {
  return (
    <>
      <PanelTitle title="Spatial Style" />
      {(selectedGeometryKind === "point" || selectedGeometryKind === "polygon") && (
        <>
          <ColorInput label="Fill" value={selectedLayer.style.fillColor} onChange={(fillColor) => patchSelectedLayer({ style: { ...selectedLayer.style, fillColor } })} />
          <RangeInput label="Fill opacity" value={selectedLayer.style.fillOpacity} min={0} max={1} step={0.05} onChange={(fillOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, fillOpacity } })} />
        </>
      )}
      <ColorInput label="Stroke" value={selectedLayer.style.strokeColor} onChange={(strokeColor) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeColor } })} />
      <RangeInput label="Stroke opacity" value={selectedLayer.style.strokeOpacity} min={0} max={1} step={0.05} onChange={(strokeOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeOpacity } })} />
      <RangeInput label="Stroke width" value={selectedLayer.style.strokeWidth} min={0} max={12} step={0.5} onChange={(strokeWidth) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeWidth } })} />
      {selectedGeometryKind === "point" && <RangeInput label="Point radius" value={selectedLayer.style.pointRadius} min={2} max={24} step={1} onChange={(pointRadius) => patchSelectedLayer({ style: { ...selectedLayer.style, pointRadius } })} />}
      {(selectedGeometryKind === "line" || selectedGeometryKind === "polygon") && <TextInput label="Dash array" value={selectedLayer.style.dashArray} onChange={(dashArray) => patchSelectedLayer({ style: { ...selectedLayer.style, dashArray } })} />}
      <PanelTitle title="Categorized Style" />
      <SelectField label="Field" value={selectedLayer.style.categoryField} onChange={(categoryField) => patchSelectedLayer({ style: { ...selectedLayer.style, categoryField } })} options={[{ value: "", label: "No category field" }, ...fieldNames(selectedLayer).map((field) => ({ value: field, label: field }))]} />
      {selectedLayer.style.categories.map((category, index) => (
        <div className="category-row" key={category.value}>
          <input value={category.label} onChange={(event) => {
            const categories = selectedLayer.style.categories.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item);
            patchSelectedLayer({ style: { ...selectedLayer.style, categories } });
          }} />
          <input type="color" value={category.fillColor} onChange={(event) => {
            const categories = selectedLayer.style.categories.map((item, itemIndex) => itemIndex === index ? { ...item, fillColor: event.target.value } : item);
            patchSelectedLayer({ style: { ...selectedLayer.style, categories } });
          }} />
        </div>
      ))}
    </>
  );
}
