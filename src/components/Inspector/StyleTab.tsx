import type { LayerManifest } from "../../types/project";
import { DashArrayField } from "../forms/DashArrayField";
import { RangeNumberField } from "../forms/RangeNumberField";
import { CategorizedStylePanel } from "./CategorizedStylePanel";
import { GraduatedStylePanel } from "./GraduatedStylePanel";
import { categoriesForField } from "../../lib/style";
import { buildGraduatedRanges } from "../../lib/graduatedBreaks";
import { normalizeGraduatedStyle } from "../../lib/styleMode";
import { ColorInput, PanelTitle, SelectField, type GeometryKind } from "./controls";

export type StyleTabProps = {
  selectedLayer: LayerManifest;
  selectedGeometryKind: GeometryKind;
  patchSelectedLayer: (patch: Partial<LayerManifest>) => void;
};

export function StyleTab({ selectedLayer, selectedGeometryKind, patchSelectedLayer }: StyleTabProps) {
  const styleMode = selectedLayer.style.mode;

  function updateStyleMode(mode: LayerManifest["style"]["mode"]) {
    if (mode === "categorized") {
      const categoryField = selectedLayer.style.categoryField;
      patchSelectedLayer({
        style: {
          ...selectedLayer.style,
          mode,
          categories: categoryField && selectedLayer.style.categories.length === 0
            ? categoriesForField(selectedLayer, categoryField)
            : selectedLayer.style.categories
        }
      });
      return;
    }

    if (mode === "graduated") {
      const graduated = normalizeGraduatedStyle(selectedLayer.style.graduated);
      patchSelectedLayer({
        style: {
          ...selectedLayer.style,
          mode,
          graduated: {
            ...graduated,
            ranges: graduated.ranges.length > 0 || !graduated.field
              ? graduated.ranges
              : buildGraduatedRanges(selectedLayer, graduated.field, graduated.method, graduated.classCount)
          }
        }
      });
      return;
    }

    patchSelectedLayer({ style: { ...selectedLayer.style, mode } });
  }

  return (
    <>
      <PanelTitle title="Style mode" />
      <SelectField
        label="Style mode"
        value={styleMode}
        onChange={(mode) => updateStyleMode(mode as LayerManifest["style"]["mode"])}
        options={[
          { value: "single", label: "Single symbol" },
          { value: "categorized", label: "Categorized" },
          { value: "graduated", label: "Graduated" }
        ]}
      />

      <PanelTitle title="Spatial Style" />
      {(selectedGeometryKind === "point" || selectedGeometryKind === "polygon") && (
        <>
          <ColorInput label="Fill" value={selectedLayer.style.fillColor} onChange={(fillColor) => patchSelectedLayer({ style: { ...selectedLayer.style, fillColor } })} />
          <RangeNumberField label="Fill opacity" value={selectedLayer.style.fillOpacity} min={0} max={1} step={0.05} onChange={(fillOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, fillOpacity } })} />
        </>
      )}
      <ColorInput label="Stroke" value={selectedLayer.style.strokeColor} onChange={(strokeColor) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeColor } })} />
      <RangeNumberField label="Stroke opacity" value={selectedLayer.style.strokeOpacity} min={0} max={1} step={0.05} onChange={(strokeOpacity) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeOpacity } })} />
      <RangeNumberField label="Stroke width" value={selectedLayer.style.strokeWidth} min={0} max={12} step={0.5} unit="px" onChange={(strokeWidth) => patchSelectedLayer({ style: { ...selectedLayer.style, strokeWidth } })} />
      {selectedGeometryKind === "point" && <RangeNumberField label="Point radius" value={selectedLayer.style.pointRadius} min={2} max={24} step={1} unit="px" onChange={(pointRadius) => patchSelectedLayer({ style: { ...selectedLayer.style, pointRadius } })} />}
      {(selectedGeometryKind === "line" || selectedGeometryKind === "polygon") && <DashArrayField label="Dash array" value={selectedLayer.style.dashArray} onChange={(dashArray) => patchSelectedLayer({ style: { ...selectedLayer.style, dashArray } })} />}

      {styleMode === "single" && (
        <section data-testid="single-style-empty-state">
          <p className="editor-note">This layer is shown with one symbol. Switch to Categorized or Graduated to symbolize by a field.</p>
        </section>
      )}
      {styleMode === "categorized" && <CategorizedStylePanel selectedLayer={selectedLayer} patchSelectedLayer={patchSelectedLayer} />}
      {styleMode === "graduated" && <GraduatedStylePanel selectedLayer={selectedLayer} patchSelectedLayer={patchSelectedLayer} />}
    </>
  );
}
