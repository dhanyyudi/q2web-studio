import type { LayerManifest } from "../../types/project";
import { fieldNames } from "../../lib/style";
import { PanelTitle, SelectField } from "./controls";

export type CategorizedStylePanelProps = {
  selectedLayer: LayerManifest;
  patchSelectedLayer: (patch: Partial<LayerManifest>) => void;
};

export function CategorizedStylePanel({ selectedLayer, patchSelectedLayer }: CategorizedStylePanelProps) {
  const fields = fieldNames(selectedLayer);

  return (
    <section data-testid="categorized-style-panel">
      <PanelTitle title="Categorized Style" />
      <SelectField label="Category field" value={selectedLayer.style.categoryField} onChange={(categoryField) => patchSelectedLayer({ style: { ...selectedLayer.style, categoryField } })} options={[{ value: "", label: "No category field" }, ...fields.map((field) => ({ value: field, label: field }))]} />
      {selectedLayer.style.categories.length === 0 ? (
        <p className="editor-note">Choose a field to symbolize this layer by category. Category generation is coming in a later task.</p>
      ) : selectedLayer.style.categories.map((category, index) => (
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
    </section>
  );
}
