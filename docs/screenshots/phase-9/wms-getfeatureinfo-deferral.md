# Phase 9 WMS GetFeatureInfo deferral

## Decision

Deferred. The current WMS import and runtime config are sufficient for tile rendering parity, but not sufficient for a safe bounded GetFeatureInfo click contract without widening this PR into runtime interaction redesign.

## Evidence inspected

- `src/types/project.ts` defines `RasterWmsLayer` with `url`, `layersParam`, `format`, `transparent`, `version`, and optional `attribution` only.
- `src/lib/rasterParsing.ts` parses `L.tileLayer.wms(...)` options for tile rendering, but does not preserve GetFeatureInfo specific metadata such as `query_layers`, `info_format`, feature-count, exception format, identify tolerance, or qgis2web `leaflet.wms.js` behavior.
- `src/runtime/runtime.ts` creates `L.tileLayer.wms(...)` for WMS layers and does not include a WMS click interaction path.
- `docs/example_export/qgis2web_raster_wms.zip` contains a minimal `L.tileLayer.wms('https://ahocevar.com/geoserver/wms', { layers: 'topp:states', format: 'image/png', transparent: true, version: '1.1.1', opacity: 0.65, attribution: 'GeoServer sample WMS' })` fixture. It does not include `leaflet.wms.js`, `GetFeatureInfo`, `info_format`, or `query_layers` metadata.
- `docs/AUDIT-2026-05-01-v4.md` describes qgis2web WMS parity as including `leaflet.wms.js` GetFeatureInfo behavior and popup rendering. That is broader than the metadata currently imported by Phase 8.

## Exact PR note text

```md
WMS GetFeatureInfo remains deferred after Phase 9 review because the current imported fixture and runtime config preserve tile rendering parity, but do not yet carry a bounded, testable click-info contract without widening scope into a larger runtime interaction redesign.
```

## Required grep command result summary

Command:

```bash
rg -n "GetFeatureInfo|feature info|raster-wms|layersParam|info_format|query_layers" src docs/example_export tests
```

Result summary, 16 matches in 7 files:

- `src/components/Inspector/RasterLayerTab.tsx`, WMS summary UI uses `layersParam`.
- `src/components/mapCanvasHooks.ts`, editor preview creates `L.tileLayer.wms` with `layersParam`.
- `src/lib/exportProject.ts`, export config preserves `layersParam`.
- `src/lib/rasterParsing.ts`, parser emits `kind: "raster-wms"` and parses `layers` into `layersParam`.
- `src/runtime/runtime.ts`, ZIP runtime creates `L.tileLayer.wms` with `layersParam`.
- `src/types/project.ts`, `RasterWmsLayer` includes `kind: "raster-wms"` and `layersParam`.
- `tests/map-render.spec.ts`, Phase 8 test asserts WMS project config preserves `url`, `layersParam`, and `opacity`.

No matches for `GetFeatureInfo`, `feature info`, `info_format`, or `query_layers` in `src`, `docs/example_export`, or `tests`.
