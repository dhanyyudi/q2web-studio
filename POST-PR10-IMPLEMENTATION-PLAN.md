# Post PR 10 Implementation Plan

> Status: operational planning after PR 9 and PR 10 merged.
> Source of truth: `docs/AUDIT-2026-04-29-v3.md` and `docs/QA-CHECKLIST-PER-PHASE.md`.

## Current Baseline

PR 9 and PR 10 move the project past the riskiest audit v3 milestones:

- Phase 0 blank map recovery is complete.
- Phase 1 MapCanvas split and StrictMode hardening are complete.
- Phase A import faithfulness is substantially complete.
- Phase B inspector UX is substantially complete.
- Phase C layer toggle, legend semantics, floating legend, and grouped tree controls are complete.
- Phase D1 zoom anomaly diagnosis is partially complete through debug-gated event logging and stable auto-fit behavior.

The next work should continue with small, single-concern PRs. Do not bundle editing hotkeys, snapping, undo/redo, properties, and geometry operations into one branch.

## Mini Audit Status

### Audit v3 Section 4.6, Layer Toggle Fallback

Status: closed on current `main`.

Evidence:

- `src/lib/qgis2webParser.ts` sets `showInLayerControl` to `true` when both parsed overlay sources are empty.
- Current expression:
  - `overlays.size === 0 && layerControlVariables.size === 0 ? true : overlays.has(layerVariable) || layerControlVariables.has(layerVariable)`

Residual risk:

- The fallback only covers empty overlay sources. Exports with partially parsed or malformed controls can still hide some layers if the parser captures only a subset.
- Add a parser smoke fixture later if we collect another qgis2web export variant.

### Audit v3 Section 4.7, Runtime Global Contract

Status: closed enough for now.

Evidence:

- `src/runtime/runtime.ts` starts with a comment documenting that the runtime overlays configuration onto the preserved qgis2web `index.html`.
- It explicitly states the dependency on `window.map` and `window.layer_*` globals.

Residual risk:

- This contract must not be broken by Phase E. Runtime preview and ZIP export should keep using the same overlay-on-original model.
- If a future feature requires regenerating `index.html` from scratch, escalate before implementation.

### Audit v3 Section 4.8, Runtime Preview

Status: foundation exists, Phase E hardening still open.

Evidence:

- `src/lib/runtimePreview.ts` builds preview content from the exported ZIP path.
- `src/components/PreviewOverlay.tsx` already supports Runtime and Editor preview modes.
- Open Tab and Export Now buttons exist.

Open risks:

- `PreviewOverlay` iframe currently uses `sandbox="allow-scripts allow-popups allow-same-origin"`. This should be reviewed in Phase E because earlier runtime-preview work intentionally avoided unnecessary same-origin iframe privileges.
- Runtime preview parity is not yet a dedicated acceptance gate.
- Leak behavior should be tested by opening and closing preview repeatedly.

## Recommended PR Sequence

### PR 11, Phase D1 Hotkeys

Goal: add keyboard shortcuts for editing modes without changing geometry mutation semantics.

Scope:

- `1`: select mode.
- `2`: point mode.
- `3`: line mode.
- `4`: polygon mode.
- `5`: rectangle mode, only if the current draw mode supports it.
- `6`: circle mode, only if the current draw mode supports it.
- `7`: route mode, only if already represented in the codebase.
- `?`: open shortcut cheatsheet.
- `Esc`: close shortcut cheatsheet.
- Add visual keycap hints to the editing toolbar.

Out of scope:

- Snapping.
- Undo/redo.
- Geometry operations.
- Persistence model changes.

Likely files:

- `src/App.tsx`
- `src/components/MapCanvas.tsx`
- `src/components/mapCanvasPanels.tsx`
- `src/styles.css`
- `tests/map-render.spec.ts`

Acceptance:

- `npm run build`
- `npm run smoke:fixture`
- `npm run smoke:export`
- `npm run smoke:map`
- E2E presses shortcut keys and asserts the active draw mode changes.
- Screenshot toolbar with keycap hints.

### PR 12, Phase D1 Snap Mode Basic

Goal: add a minimal snapping toggle for drawing and editing.

Scope:

- Add Snap ON/OFF UI.
- Snap to nearby vertices with a conservative default tolerance.
- Snap to segments only if TerraDraw and the Leaflet adapter support it cleanly.
- Keep debug evidence gated behind `?debug=1` if event order is relevant.

Out of scope:

- Undo/redo.
- Multi-select transform.
- Geometry operations.

Required research:

- Fetch current TerraDraw and adapter docs via Context7 before changing snapping API calls.

Likely files:

- `src/components/mapCanvasHooks.ts`
- `src/components/MapCanvas.tsx`
- `src/App.tsx`
- `src/styles.css`
- `tests/map-render.spec.ts`

Acceptance:

- All global gates pass.
- Manual QA demonstrates vertex snapping on the Cirebon fixture.
- If segment snapping is included, manual QA demonstrates segment snapping separately.

### PR 13, Phase D2 Undo and Redo Foundation

Goal: introduce a small history foundation for geometry edits.

Scope:

- `Cmd+Z` undo.
- `Cmd+Shift+Z` redo.
- Minimal history stack with action labels.
- Store enough state to undo geometry changes made in the editor.

Out of scope:

- Full history timeline UI polish.
- Geometry operations.
- Multi-select transform.

Likely files:

- `src/state/history.ts` or `src/lib/history.ts`
- `src/components/mapCanvasHooks.ts`
- `src/App.tsx`
- `src/types/project.ts`
- `tests/map-render.spec.ts`

Acceptance:

- All global gates pass.
- E2E or component-level test proves edit, undo, redo behavior.
- Manual QA repeats undo/redo five times without desync.

### PR 14, Phase D3 Properties Panel

Goal: allow editing selected feature attributes before introducing spatial operations.

Scope:

- Show selected feature properties.
- Edit existing key values.
- Add key.
- Delete key with confirmation.
- Reflect changes in attribute table.
- Persist changes to OPFS and exported GeoJSON.

Out of scope:

- Geometry mutation.
- Buffer/simplify/convex hull.
- Multi-select transform.

Acceptance:

- All global gates pass.
- Reload preserves property edits.
- Exported ZIP contains updated properties.

### PR 15, Phase D3 Buffer Operation

Goal: add the first spatial operation as a standalone feature.

Scope:

- Buffer selected line or polygon feature.
- Input distance in meters.
- Create a new output layer, for example `Sungai_buffer_50m`.
- Export output layer in ZIP.

Required research:

- Fetch Turf buffer docs via Context7 before adding or changing API calls.

Acceptance:

- All global gates pass.
- Manual QA buffers a Sungai feature and verifies the new polygon layer.
- Exported GeoJSON includes the generated layer.

### PR 16, Phase D3 Simplify Operation

Goal: add geometry simplification as a separate operation.

Scope:

- Simplify selected feature or layer with a tolerance slider.
- Preview before applying, if feasible without large scope.
- Apply writes geometry changes through the same persistence path as prior editing work.

Risk:

- Do not confuse this with existing render-time simplification. This PR must mutate project data only after explicit user apply.

Acceptance:

- All global gates pass.
- Manual QA confirms geometry changes persist and export.

### PR 17, Phase D3 Convex Hull Operation

Goal: add convex hull after buffer and simplify foundations are stable.

Scope:

- Run convex hull on selected features.
- Create a new output polygon layer.

Acceptance:

- All global gates pass.
- Manual QA confirms output layer and export.

### PR 18+, Remaining Phase D3 Operations

Candidates:

- Multi-select lasso.
- Translate, rotate, scale transforms.
- Polygon to line.
- Merge.
- Split.
- Divide.

Rule:

- Keep each major operation in its own PR unless the implementation is genuinely shared and small.

### Phase E1, Runtime Preview Parity Core

Goal: turn the existing runtime preview foundation into a verified product feature.

Scope:

- Ensure Runtime preview mirrors ZIP export for widgets, header/footer, sidebar, welcome, layer control, and legend.
- Revisit iframe sandbox permissions and remove unnecessary privileges if possible.
- Add dedicated e2e coverage for runtime preview mode.

Acceptance:

- All global gates pass.
- E2E opens preview, selects Runtime, and asserts iframe runtime script/config are loaded.
- Screenshot comparison: editor preview, runtime preview, and ZIP runtime.

### Phase E2, Runtime Preview Polish

Goal: complete user-facing runtime preview affordances.

Scope:

- Harden Open Tab.
- Verify Export Now from preview matches topbar export.
- Add leak regression coverage for repeated open/close cycles.

Acceptance:

- All global gates pass.
- Manual QA opens and closes preview ten times with no console errors and no stale blob URL behavior.

## Always-On Gates

Run these before opening every PR:

```bash
npm run build
npm run smoke:fixture
npm run smoke:export
npm run smoke:map
```

For any PR touching runtime, preview, export, popup, labels, legend, layer control, or widgets:

- Test editor preview.
- Export ZIP.
- Serve the extracted ZIP with `python3 -m http.server`.
- Capture editor and ZIP runtime screenshots.

## Logging

After each PR merges, append the root training repo changelog:

- `/Users/dhanypedia/webgis-basic-with-qgis2web/docs/agents/changelog/2026-04.md`

Include:

- Phase or PR ID.
- Files changed.
- Test results.
- Screenshot or evidence paths.
- Merge commit.
