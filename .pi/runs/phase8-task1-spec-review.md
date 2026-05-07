# Phase 8 Task 1 Spec Compliance Review, commit 67fc8a2

## Verdict

CHANGES REQUIRED

## Scope reviewed

Reviewed commit `67fc8a2` only against `docs/superpowers/plans/2026-05-03-phase8-raster-parity.md`, Task 1, "Lock types and back-compat before any raster rendering".

## Findings

### 1. Project layer union is declared but not wired into `Qgis2webProject.layers`

Task 1 Step 3 requires replacing project layer arrays from `LayerManifest[]` to `ProjectLayer[]` where needed.

Current `src/types/project.ts` declares:

```ts
export type ProjectLayer = LayerManifest | RasterImageLayer | RasterWmsLayer | RasterPmtilesLayer;
```

But `Qgis2webProject` still has:

```ts
layers: LayerManifest[];
```

This means the central project model is still vector only. Raster layers cannot be represented in `project.layers` without type escapes, so Task 1's main type lock is incomplete.

### 2. Back-compat normalization exists, but its protection is weakened by the unchanged project type

`hydrateProject()` and `migrateProject()` call `normalizeProjectLayerKind()` and skip vector-only normalization for raster guards, which is aligned with Task 1 Step 5.

However, because `Qgis2webProject.layers` remains `LayerManifest[]`, the project state and helper signatures still communicate that all layers are vectors. This leaves follow-up Task 2 and Task 3 work without the explicit union contract Task 1 was supposed to establish.

### 3. `projectUpdates.updateLayer()` remains vector-specific

`updateLayer()` still accepts `patch: Partial<LayerManifest>` and maps over `project.layers` without normalizing replacement or clone output. Task 1 Step 5 says to apply the same assumption in update helpers that clone or replace layers.

This may be acceptable for vector-only update helpers later if a separate raster update helper is planned, but Task 1 does not document that split. At minimum, the helper contract should not accidentally imply that a raster layer can be patched with vector-only fields, or the function should be explicitly constrained to vector layers.

### 4. Minor scope overreach, `src/lib/qgis2webParser.ts`

Task 1 file list does not include `src/lib/qgis2webParser.ts`, but the commit adds `kind: "vector"` to parsed layers.

This is small and consistent with the discriminator goal, not rendering or parser raster support. I would not block on this alone. The blocking issue is the incomplete `Qgis2webProject.layers` union.

## Task 1 checklist

| Step | Status | Note |
|---|---|---|
| Step 1, smoke assertion for raster-capable layer union | PASS | Synthetic raster kind assertion added in `scripts/smoke-fixture.ts`. |
| Step 2, baseline smoke before type changes | NOT VERIFIABLE FROM COMMIT | Historical run is not encoded in commit. Current smoke passes. |
| Step 3, add raster types and project layer union | PARTIAL | Raster types and `ProjectLayer` exist, but `Qgis2webProject.layers` is still `LayerManifest[]`. |
| Step 4, add type guards in `rasterParsing.ts` | PASS | Guards for vector, image, WMS, and PMTiles are present. Extra normalizer is in scope for Step 5. |
| Step 5, normalize old projects in hydration and update helpers | PARTIAL | Hydration and migration normalize old layers, but update helper contracts remain vector-specific and project array type is still vector-only. |
| Step 6, build and smoke fixture | PASS | Locally verified, `npm run build` exit 0, `npm run smoke:fixture` exit 0. |
| Step 7, commit | PASS | Commit exists with expected message. |

## Overreach assessment

No raster rendering, runtime export, WMS, PMTiles, fixture onboarding, or UI work was introduced. That is good.

The only scope concern is the one-line parser discriminator change in `qgis2webParser.ts`, which is outside the Task 1 file list but still directly supports locking vector layer kind. I do not consider it harmful overreach.

## Required changes

1. Change the central project model so `Qgis2webProject.layers` uses `ProjectLayer[]`, or provide an equivalent explicit layer union at the project boundary.
2. Revisit `projectUpdates.ts` helper signatures after that change. Either make generic layer replacement safe for `ProjectLayer`, or keep vector-only helpers explicitly guarded and typed so raster layers cannot be accidentally patched as `LayerManifest`.
3. Re-run `npm run build` and `npm run smoke:fixture` after the type contract is truly switched to the union.

