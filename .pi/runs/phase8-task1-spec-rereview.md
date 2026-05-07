# Phase 8 Task 1 Spec Re-review, branch audit-v4-phase8-raster-parity

## Verdict

APPROVED

## Scope reviewed

Re-reviewed Task 1 after commits `67fc8a2` and `5bfea9b` against:

- `docs/superpowers/plans/2026-05-03-phase8-raster-parity.md`, Task 1
- prior gaps recorded in `.pi/runs/phase8-task1-spec-review.md`

## Prior gaps status

### 1. `Qgis2webProject.layers` still vector-only

Resolved.

`src/types/project.ts` now wires the central project model to the union:

```ts
layers: ProjectLayer[];
```

This closes the main blocker from the previous review. The project boundary now explicitly allows vector and raster layer kinds before any rendering work starts.

### 2. Back-compat normalization weakened by unchanged project type

Resolved.

Because `Qgis2webProject.layers` now uses `ProjectLayer[]`, the existing normalization in:

- `src/lib/projectHydration.ts`
- `src/lib/projectUpdates.ts`
- `src/lib/rasterParsing.ts`

now sits on top of the correct union contract instead of a vector-only project shape.

### 3. `projectUpdates` helper remained ambiguously vector-specific

Resolved enough for Task 1.

The helper has been made explicit as `updateVectorLayer(...)`, and its implementation now guards with `isVectorLayer(...)` before applying vector patches. That matches Task 1 intent, which is to make pre-raster helpers safe and explicit, not to add full raster mutation helpers yet.

This is acceptable for Task 1 because:

- it prevents accidental patching of raster layers as vector layers
- it keeps existing vector workflows typed and safe
- it does not prematurely invent raster editing APIs before Task 3 onward

## Task 1 checklist

| Step | Status | Note |
|---|---|---|
| Step 1, smoke assertion for raster-capable layer union | PASS | Synthetic raster kind assertion exists in `scripts/smoke-fixture.ts`. |
| Step 2, baseline smoke before type changes | NOT VERIFIABLE FROM FINAL DIFF | Historical baseline run is not provable from code, but not a blocker for spec compliance at re-review stage. |
| Step 3, add raster types and project layer union | PASS | `ProjectLayer` union exists and `Qgis2webProject.layers` now uses `ProjectLayer[]`. |
| Step 4, add type guards in `rasterParsing.ts` | PASS | Guards for vector, image, WMS, and PMTiles are present, plus `normalizeProjectLayerKind()`. |
| Step 5, normalize old projects in hydration and update helpers | PASS | Hydration and migration normalize missing `kind` to `vector`, and vector update helpers are now explicitly guarded. |
| Step 6, build and smoke fixture | PASS | Re-verified locally, `npm run build` and `npm run smoke:fixture` both pass. |
| Step 7, commit | PASS | Both follow-up commits exist, including the fixup commit that closes the prior type wiring gap. |

## Rules audit

| Rule | Status | Note |
|---|---|---|
| One concern per PR | PASS | Still confined to Task 1 type and hydration groundwork. No raster rendering or runtime behavior added. |
| StrictMode must stay on | PASS | `src/main.tsx` still contains `<React.StrictMode>`. |
| No premature editor/runtime coupling | PASS | No Task 2 to Task 8 behavior leaked in. |
| Back-compat before new rendering | PASS | Old vector layers normalize to `kind: "vector"` before future raster work. |

## Notes

- There is still broad vector-only usage in downstream helpers such as preview bounds, legend assembly, and runtime export filtering. That is expected at this stage and belongs to later Phase 8 tasks, not Task 1.
- `src/lib/qgis2webParser.ts` still types its local parsed collection as `LayerManifest[]`. That is acceptable for Task 1 because raster parsing has not started yet, and the project-level union contract is already in place.

## Conclusion

The blocking gaps from the previous review are closed. Task 1 now satisfies the plan intent, lock the layer type model and preserve back-compat before raster rendering work begins.
