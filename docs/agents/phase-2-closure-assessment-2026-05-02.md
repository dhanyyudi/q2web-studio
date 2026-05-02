# Audit V4 Phase 2 Closure Assessment, 2026-05-02

## Scope
This report evaluates whether Audit V4 Phase 2 is closed on branch `audit-v4-phase2-closure-reconciliation` from current `main` after merge commit `1b8f359`.

## Evidence sources
- `docs/AUDIT-2026-05-01-v4.md`
- `src/App.tsx`
- `src/components/Topbar.tsx`
- `src/components/SidePanel.tsx`
- `src/components/EmptyState.tsx`
- `src/components/Inspector/*`
- `src/hooks/useImportExport.ts`
- `tests/map-render.spec.ts`
- `git log --oneline`

## Verdict
Phase 2 is not fully closed. Phase 2b appears closed on source and targeted test evidence, but Phase 2a remains open because `src/hooks/useProjectState.ts` does not exist and `src/App.tsx` is still far above the Audit V4 shell target.

## Audit V4 criteria matrix

### Phase 2a, File split
- [x] `src/components/Topbar.tsx` exists and owns top action bar
- [x] `src/components/SidePanel.tsx` exists and owns left side panel
- [x] `src/components/EmptyState.tsx` exists and owns landing state
- [x] `src/components/Inspector/InspectorShell.tsx` exists and owns tabs container, mode switcher, breadcrumb
- [x] `src/components/Inspector/BrandingTab.tsx` exists
- [x] `src/components/Inspector/LayerTab.tsx` exists
- [x] `src/components/Inspector/StyleTab.tsx` exists
- [x] `src/components/Inspector/PopupTab.tsx` exists
- [x] `src/components/Inspector/LegendTab.tsx` exists
- [x] `src/components/Inspector/SelectedFeaturePanel.tsx` exists
- [x] `src/components/Inspector/SelectionToolbar.tsx` exists
- [x] `src/components/Inspector/GeometryOpsPanel.tsx` exists
- [ ] `src/hooks/useProjectState.ts` exists
- [x] `src/hooks/useImportExport.ts` exists
- [ ] `src/App.tsx` is ≤ 400 lines
- [ ] `src/App.tsx` is mostly composition plus top-level state

### Phase 2b, Behavioral reorg
- [x] Layer tab uses ordered regions from breadcrumb to labels
- [x] Selection toolbar is sticky at top when features are selected
- [x] Manual legend items live only in project inspector
- [x] Binary toggles use shadcn `Switch`
- [x] Geometry operations are filtered by geometry type

## Phase 2a, file existence results

Command run:

```bash
for f in \
  src/components/Topbar.tsx \
  src/components/SidePanel.tsx \
  src/components/EmptyState.tsx \
  src/components/Inspector/InspectorShell.tsx \
  src/components/Inspector/BrandingTab.tsx \
  src/components/Inspector/LayerTab.tsx \
  src/components/Inspector/StyleTab.tsx \
  src/components/Inspector/PopupTab.tsx \
  src/components/Inspector/LegendTab.tsx \
  src/components/Inspector/SelectedFeaturePanel.tsx \
  src/components/Inspector/SelectionToolbar.tsx \
  src/components/Inspector/GeometryOpsPanel.tsx \
  src/hooks/useProjectState.ts \
  src/hooks/useImportExport.ts; do \
  if [ -f "$f" ]; then echo "PASS $f"; else echo "FAIL $f"; fi; \
 done
```

Observed output:

```text
PASS src/components/Topbar.tsx
PASS src/components/SidePanel.tsx
PASS src/components/EmptyState.tsx
PASS src/components/Inspector/InspectorShell.tsx
PASS src/components/Inspector/BrandingTab.tsx
PASS src/components/Inspector/LayerTab.tsx
PASS src/components/Inspector/StyleTab.tsx
PASS src/components/Inspector/PopupTab.tsx
PASS src/components/Inspector/LegendTab.tsx
PASS src/components/Inspector/SelectedFeaturePanel.tsx
PASS src/components/Inspector/SelectionToolbar.tsx
PASS src/components/Inspector/GeometryOpsPanel.tsx
FAIL src/hooks/useProjectState.ts
PASS src/hooks/useImportExport.ts
```

Interpretation:
- The component split is mostly present.
- The explicit Phase 2a hook requirement, `src/hooks/useProjectState.ts`, is still missing.

## Phase 2a, App shell result

Command run:

```bash
wc -l src/App.tsx
```

Observed output:

```text
2009 src/App.tsx
```

Audit target from `docs/AUDIT-2026-05-01-v4.md`:
- `App.tsx` should be `≤ 400` lines
- `App.tsx` should be mostly composition plus top-level state

Result:
- FAIL

## Phase 2a, composition assessment

Command run:

```bash
grep -n "^  function \|^function \|^  const .* = useState\|^  const .* = useMemo" src/App.tsx | head -120
```

Observed highlights:
- 20 plus `useState` declarations remain local in `App.tsx`
- local `useMemo` state derivations remain in `App.tsx`
- many project mutation and geometry operation handlers remain local, including:
  - `updateProject`
  - `undoProject`
  - `redoProject`
  - `patchSelectedLayer`
  - `simplifySelectedFeature`
  - `bufferSelectedFeature`
  - `mergeSelectedLayer`
  - `polygonToLineSelectedFeature`
  - `convexHullSelectedFeature`
  - `selectAllFeatures`
  - `clearSelection`
  - `translateSelectedFeatures`
  - `rotateSelectedFeatures`
  - `scaleSelectedFeatures`
  - `splitLineSelectedFeature`
  - `divideLineSelectedFeature`
  - `setMapSetting`
  - `setPopupSetting`
  - `setLegendSetting`
  - `toggleRuntimeWidget`
  - basemap CRUD helpers
  - text annotation helpers
- many pure helper functions also remain local at the bottom of `App.tsx`

Assessment:
`src/App.tsx` is not yet mostly composition. It still owns extensive local state, mutation handlers, geometry operations, selection logic, hydration, geometry transforms, and workspace orchestration. The mechanical split has progressed materially, but the exact Phase 2a closure condition is not met.

## Phase 2b, source inspection

Relevant source observations:
- `src/components/Inspector/LayerTab.tsx` uses `SelectionToolbar`
- `src/components/Inspector/LayerTab.tsx` uses `GeometryOpsPanel`
- `src/components/Inspector/LayerTab.tsx` uses `SwitchLabel` for binary toggles
- `src/components/Inspector/ProjectMapTab.tsx` owns project manual legend UI and explanatory copy
- `src/components/Inspector/SelectionToolbar.tsx` uses `data-testid="layer-section-selection-toolbar"`
- `src/components/Inspector/InspectorShell.tsx` exposes `data-testid="layer-section-tabs"`

Assessment against Audit V4 Phase 2b:
- PASS: Layer tab has ordered split regions driven by dedicated subcomponents
- PASS: Selection toolbar exists as its own section and is intended to be sticky
- PASS: Manual legend items are handled in project inspector, not only layer inspector
- PASS: Binary toggles in split inspector files are standardized through `SwitchLabel`
- PASS: Geometry operation visibility is delegated through `GeometryOpsPanel` and tested per geometry type

## Phase 2b, test-backed assessment

Targeted command run:

```bash
npx playwright test tests/map-render.spec.ts -g "phase 2b"
```

Result in this environment:
- FAIL to execute browser tests because Playwright browser binaries are missing

Observed error:

```text
Error: browserType.launch: Executable doesn't exist at /Users/dhanypedia/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell
Looks like Playwright was just installed or updated.
Please run the following command to download new browsers:

    npx playwright install
```

Available static evidence from `tests/map-render.spec.ts`:
- `phase 2b layer inspector uses ordered sections with sticky selection toolbar and geometry-specific ops`
- `phase 2b manual legend lives in project inspector instead of layer inspector`

These tests explicitly assert:
- ordered section layout
- sticky toolbar positioning
- geometry-specific operation filtering
- manual legend location in project inspector

Broader verification commands run:

```bash
npm run build
npm run smoke:fixture
npm run smoke:export
npm run smoke:map
```

Observed results:
- `npm run build`: PASS
- `npm run smoke:fixture`: PASS
- `npm run smoke:export`: PASS
- `npm run smoke:map`: FAIL due missing Playwright browser executable, not due application assertion failures

Assessment:
The current source structure and existing named Playwright coverage strongly support that merged Phase 2b behavior is in place. However, this session cannot independently rerun browser-backed tests until `npx playwright install` is executed in the environment.

## Final verdict

### Phase 2a
Status: OPEN

Reason:
- `src/hooks/useProjectState.ts` is still missing, despite being an explicit Audit V4 Phase 2a deliverable.
- `src/App.tsx` is still 2009 lines, far above the stated `≤ 400` target.
- `src/App.tsx` still contains extensive state, business logic, geometry operations, and helper functions, so it is not yet a thin composition shell.

### Phase 2b
Status: MOSTLY CLOSED

Reason:
- Source code matches the expected split and behavioral reorganization from Audit V4.
- Named Playwright tests for Phase 2b exist and encode the intended behavior.
- This session could not fully rerun browser-backed verification because Playwright browser binaries are missing in the local environment.

### Overall Phase 2 status
Status: NOT FULLY CLOSED

Decision:
Phase 2 is not considered fully closed until the remaining Phase 2a gaps are resolved, specifically `src/hooks/useProjectState.ts` creation and reduction of `src/App.tsx` to the thin composition shell required by Audit V4.

## Recommended next step

Do not start Phase 3 yet. The safest next step is a narrow closure PR for remaining Phase 2a work:

1. Create `src/hooks/useProjectState.ts`
2. Extract remaining App-local business logic into hooks or focused utilities
3. Reduce `src/App.tsx` to a composition shell
4. Re-run `npm run build`, `npm run smoke:fixture`, `npm run smoke:export`, and `npm run smoke:map`
5. Re-check line count with `wc -l src/App.tsx`

## Executive summary

OpenCode successfully merged major Phase 2 split work, especially the inspector split and behavioral reorganization. However, strict Audit V4 closure has not been reached because `src/App.tsx` remains substantially larger than the target and `src/hooks/useProjectState.ts` is still absent. The correct next move is Phase 2a closure, not Phase 3 kickoff.

## Command output summary

```text
git status --short --branch
## audit-v4-phase2-closure-reconciliation
 M .gitignore
?? .ai/
?? .mcp.json
?? .pi/
?? POST-PR10-IMPLEMENTATION-PLAN.md
?? opencode.json

wc -l src/App.tsx
2009 src/App.tsx

npm run build
PASS

npm run smoke:fixture
PASS

npm run smoke:export
PASS

npx playwright test tests/map-render.spec.ts -g "phase 2b"
FAIL, Playwright browser executable missing

npm run smoke:map
FAIL, Playwright browser executable missing
```
