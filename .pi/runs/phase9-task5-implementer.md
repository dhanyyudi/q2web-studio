DONE_WITH_CONCERNS

Decision: Deferral chosen honestly. Current WMS metadata is not sufficient to implement a safe bounded GetFeatureInfo click request in runtime without widening scope beyond Task 5.

Reasoning:
- `src/types/project.ts` `RasterWmsLayer` only carries tile rendering fields, `url`, `layersParam`, `format`, `transparent`, `version`, and optional `attribution`.
- `src/lib/rasterParsing.ts` only parses `L.tileLayer.wms(...)` tile options. It does not parse or preserve `GetFeatureInfo` contract data such as `query_layers`, `info_format`, feature count, exception handling, tolerance, popup mode, or plugin specific behavior.
- `src/runtime/runtime.ts` only instantiates `L.tileLayer.wms(...)` and toggles visibility. There is no existing WMS click interaction seam to extend minimally without also deciding popup rendering, response parsing, and request defaults.
- The WMS fixture in `docs/example_export/qgis2web_raster_wms.zip` is minimal and only contains a plain `L.tileLayer.wms(...)` call. It does not include `leaflet.wms.js`, `GetFeatureInfo`, `info_format`, or `query_layers` metadata.
- `docs/AUDIT-2026-05-01-v4.md` explicitly frames qgis2web parity as WMS tile plus `leaflet.wms.js` GetFeatureInfo popup behavior, which is broader than the current imported config.

Files changed:
- `docs/screenshots/phase-9/wms-getfeatureinfo-deferral.md`, added deferral note with exact PR note text and evidence summary.

Tests:
- No code or test implementation was added because feasibility check failed honestly.
- Command run for required summary:
  - `rg -n "GetFeatureInfo|feature info|raster-wms|layersParam|info_format|query_layers" src docs/example_export tests`
  - Result: 16 matches in 7 files.
  - Summary:
    - `src/components/Inspector/RasterLayerTab.tsx`, WMS summary UI references `layersParam`.
    - `src/components/mapCanvasHooks.ts`, editor WMS preview uses `layersParam`.
    - `src/lib/exportProject.ts`, export preserves `layersParam`.
    - `src/lib/rasterParsing.ts`, parser emits `raster-wms` and parses `layers` into `layersParam`.
    - `src/runtime/runtime.ts`, runtime creates `L.tileLayer.wms(...)` with `layersParam`.
    - `src/types/project.ts`, `RasterWmsLayer` contains `kind` and `layersParam` only for WMS-specific metadata.
    - `tests/map-render.spec.ts`, existing Phase 8 test asserts `url`, `layersParam`, and `opacity`.
  - No matches for `GetFeatureInfo`, `feature info`, `info_format`, or `query_layers` in `src`, `docs/example_export`, or `tests`.

Commit:
- SHA: `71dcfb5`
- Message: `docs(raster): defer bounded wms getfeatureinfo parity`

PR note text to use:

```md
WMS GetFeatureInfo remains deferred after Phase 9 review because the current imported fixture and runtime config preserve tile rendering parity, but do not yet carry a bounded, testable click-info contract without widening scope into a larger runtime interaction redesign.
```
