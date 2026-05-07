# Phase 8 Task 1 spec review fix

## Summary
Fixed the Task 1 spec review gaps on the current branch. The central project boundary now uses the explicit `ProjectLayer[]` union, and vector update helpers are explicitly vector only.

## Changes
- `src/types/project.ts`
  - Changed `Qgis2webProject.layers` from `LayerManifest[]` to `ProjectLayer[]`.
- `src/lib/projectUpdates.ts`
  - Replaced generic `updateLayer()` with explicit `updateVectorLayer()`.
  - `updateVectorLayer()` normalizes legacy vector kind and refuses to patch raster layers.
  - Existing geojson and field helpers remain vector guarded.
- `src/hooks/useProjectState.ts`
  - Selected layer and selected feature paths now narrow to vector layers before vector-only access.
  - Large dataset warning filters vector layers only.
- `src/components/AppWorkspace.tsx`
  - Layer visibility update uses `updateVectorLayer()`.
- `src/components/MapCanvas.tsx`
  - Existing editor render path is explicitly vector only for Task 1. Raster rendering remains unimplemented.
- `src/components/SidePanel.tsx`
  - Layer list can accept `ProjectLayer` and displays raster kind labels without vector field access.
- `src/components/mapCanvasHelpers.ts`
  - Popup CSS overrides filter vector layers only.
- `src/lib/exportProject.ts`
  - Current runtime export path remains vector only, explicitly filtered. Raster export remains unimplemented.
- `src/lib/opfs.ts`
  - OPFS layer hydration accepts `ProjectLayer` and leaves raster layers untouched.

## Verification
- `npm run build`: PASS
- `npm run smoke:fixture`: PASS

## Commit
- `5bfea9b fix(raster): wire project layer union`

## Scope note
No raster rendering, raster fixtures, parser raster support, runtime raster export, WMS, or PMTiles work was implemented.
