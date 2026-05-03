import type { GraduatedMethod, LayerManifest } from "../../types/project";
import { buildGraduatedRanges } from "../../lib/graduatedBreaks";
import { normalizeGraduatedStyle, numericFieldNames } from "../../lib/styleMode";
import { PanelTitle, SelectField } from "./controls";

export type GraduatedStylePanelProps = {
  selectedLayer: LayerManifest;
  patchSelectedLayer: (patch: Partial<LayerManifest>) => void;
};

export function GraduatedStylePanel({ selectedLayer, patchSelectedLayer }: GraduatedStylePanelProps) {
  const numericFields = numericFieldNames(selectedLayer);
  const graduated = normalizeGraduatedStyle(selectedLayer.style.graduated);

  function updateGraduated(next: Partial<typeof graduated>) {
    const clearsGeneratedRanges = "field" in next || "method" in next || "classCount" in next;
    const updated = normalizeGraduatedStyle({
      ...graduated,
      ...next,
      ranges: clearsGeneratedRanges ? [] : next.ranges ?? graduated.ranges
    });
    patchSelectedLayer({
      style: {
        ...selectedLayer.style,
        mode: "graduated",
        graduated: updated
      }
    });
  }

  function generateRanges() {
    const updated = normalizeGraduatedStyle({
      ...graduated,
      ranges: graduated.method === "manual"
        ? graduated.ranges
        : buildGraduatedRanges(selectedLayer, graduated.field, graduated.method, graduated.classCount)
    });
    patchSelectedLayer({
      style: {
        ...selectedLayer.style,
        mode: "graduated",
        graduated: updated
      }
    });
  }

  return (
    <section data-testid="graduated-style-panel">
      <PanelTitle title="Graduated Style" />
      <SelectField
        label="Graduated field"
        value={graduated.field}
        onChange={(field) => updateGraduated({ field })}
        options={[{ value: "", label: "No numeric field" }, ...numericFields.map((field) => ({ value: field, label: field }))]}
      />
      <SelectField
        label="Method"
        value={graduated.method}
        onChange={(method) => updateGraduated({ method: method as GraduatedMethod })}
        options={[
          { value: "equal", label: "Equal interval" },
          { value: "quantile", label: "Quantile" },
          { value: "manual", label: "Manual" }
        ]}
      />
      <label className="field">
        <span>Classes</span>
        <input
          aria-label="Classes"
          type="number"
          min={2}
          max={7}
          step={1}
          value={graduated.classCount}
          onChange={(event) => updateGraduated({ classCount: Number(event.target.value) })}
        />
      </label>

      <button type="button" className="btn secondary" onClick={generateRanges} disabled={!graduated.field || graduated.method === "manual"}>
        Generate ranges
      </button>

      {numericFields.length === 0 && <p className="editor-note">No numeric fields were found in this layer.</p>}
      {graduated.field && graduated.ranges.length === 0 && <p className="editor-note">No numeric values were found for this field.</p>}
      {graduated.ranges.map((range, index) => (
        <div className="graduated-range-row category-row" key={`${range.min}-${range.max}-${index}`}>
          <span>Class {index + 1}</span>
          <input value={range.label} aria-label={`Graduated range ${index + 1} label`} onChange={(event) => {
            const ranges = graduated.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item);
            updateGraduated({ ranges });
          }} />
          <input type="color" value={range.fillColor} aria-label={`Graduated range ${index + 1} fill`} onChange={(event) => {
            const ranges = graduated.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, fillColor: event.target.value } : item);
            updateGraduated({ ranges });
          }} />
        </div>
      ))}
    </section>
  );
}
