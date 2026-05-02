export type SelectionToolbarProps = {
  selectedFeatureIds: string[];
  selectAllFeatures: () => void;
  translateSelectedFeatures: () => void;
  rotateSelectedFeatures: () => void;
  scaleSelectedFeatures: () => void;
  clearSelection: () => void;
};

export function SelectionToolbar({ selectedFeatureIds, selectAllFeatures, translateSelectedFeatures, rotateSelectedFeatures, scaleSelectedFeatures, clearSelection }: SelectionToolbarProps) {
  return (
    <div className="multi-select-actions sticky-selection-toolbar" data-testid="layer-section-selection-toolbar">
      <div data-testid="layer-selection-toolbar" className="layer-selection-toolbar-content">
        <div data-testid="multi-select-panel">
          <span>{selectedFeatureIds.length} features selected</span>
          <button type="button" className="btn compact" onClick={selectAllFeatures}>Select all</button>
          <button type="button" className="btn compact" onClick={translateSelectedFeatures} disabled={selectedFeatureIds.length === 0}>Translate selected</button>
          <button type="button" className="btn compact" onClick={rotateSelectedFeatures} disabled={selectedFeatureIds.length === 0}>Rotate selected</button>
          <button type="button" className="btn compact" onClick={scaleSelectedFeatures} disabled={selectedFeatureIds.length === 0}>Scale selected</button>
          <button type="button" className="btn compact" onClick={clearSelection} disabled={selectedFeatureIds.length === 0}>Clear selection</button>
        </div>
      </div>
    </div>
  );
}
