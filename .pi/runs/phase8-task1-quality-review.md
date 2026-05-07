CHANGES REQUIRED

## Review
- Correct: The core type safety direction is good. `src/types/project.ts` widens `Qgis2webProject.layers` to a discriminated union, and `src/lib/rasterParsing.ts` adds reusable guards plus `normalizeProjectLayerKind()`. This is a minimal, readable way to prepare for raster support while keeping legacy vector projects valid through `kind?: "vector"`.
- Correct: Several vector only paths are now explicitly guarded. Evidence includes `src/lib/exportProject.ts` filtering with `isVectorLayer` before serializing GeoJSON and style data, `src/lib/projectHydration.ts` skipping vector specific feature ID work for non vector layers, and `src/lib/projectUpdates.ts` rejecting non vector mutations in feature and field helpers.
- Correct: Build passes. Verified with `npm run build`, which completed successfully with `tsc --noEmit` and `vite build`.

- Blocker: Raster layer visibility toggles are wired to a vector only updater, so the UI exposes a control that silently does nothing for raster layers. Evidence:
  - `src/components/SidePanel.tsx:78-88` renders every `project.layers` entry and calls `onUpdateLayer({ ...layer, visible: !layer.visible })` for all layer kinds.
  - `src/components/AppWorkspace.tsx:145` implements that callback with `updateVectorLayer(project, layer.id, { visible: layer.visible })`.
  - `src/lib/projectUpdates.ts:56-66` explicitly no ops for non vector layers via `if (layer.id !== layerId || !isVectorLayer(layer)) return layer;`.
  Result, once raster layers exist, Hide or Show appears available but cannot change raster visibility. This is both a regression risk and a scope leak because the UI claims parity that the state layer does not support yet.

- Blocker: Raster layers can be selected from the side panel, but selection state falls back to the first vector layer instead of preserving or explicitly rejecting raster selection. Evidence:
  - `src/components/SidePanel.tsx:78-83` allows clicking any `project.layers` item.
  - `src/hooks/useProjectState.ts:63-68` resolves `selectedLayer` by finding `selectedLayerId`, then only returns it if `isVectorLayer(matched)`, otherwise it falls back to `project.layers.find(isVectorLayer)`.
  - `src/components/MapCanvas.tsx:67-74` repeats the same vector only selection logic for map preview.
  Result, when a raster layer is clicked, `selectedLayerId` changes but the effective selected layer used by inspector and canvas becomes a different vector layer. That is confusing state, weakens readability, and is not an explicit enough guard for vector only helpers. The UI should either disable layer selection for non vector entries, keep a separate project layer selection model, or show a clear raster preview only state.

- Note: The vector guard pattern itself is readable and appropriately narrow, but the current implementation only guards data access, not the surrounding UI affordances. The remaining work should be to make non vector layers explicitly non editable and non toggleable where support is not implemented yet, rather than letting them flow through generic layer UI and silently degrade.
