# q2webstudio Architecture

This note documents the current local editor, Service Worker preview, import safety, and static runtime export flow.

## Core flow

1. The user imports a qgis2web Leaflet folder or ZIP file.
2. Import code normalizes the virtual file tree and rejects unsafe paths.
3. The parser builds the internal project state from the qgis2web export.
4. React and Leaflet render the editor preview.
5. Runtime export code builds the static runtime files.
6. Runtime preview publishes those files to the Service Worker.
7. The preview iframe loads `/preview/{token}/index.html`.
8. Export downloads a standalone ZIP for static hosting.

## Service Worker preview

The runtime preview is intentionally separated from the main app document.

- File: `public/q2ws-preview-sw.js`.
- Preview bundles are stored in Service Worker memory by token.
- `preview:publish` stores preview entries for a token.
- `preview:evict` removes preview entries for a token.
- `PREVIEW_TTL_MS` is set to 30 minutes.
- Preview responses are served from `/preview/{token}/*`, including `/preview/{token}/index.html`.
- Preview responses use `Cache-Control: no-store`.

The app side builds preview entries from the ZIP output, then calls the bridge:

- `src/lib/runtimePreview.ts` calls `exportProjectZip()` and converts ZIP files into preview entries.
- `src/lib/previewBridge.ts` publishes entries with `preview:publish` and returns `/preview/{token}/index.html`.
- `src/lib/previewBridge.ts` also provides eviction through `preview:evict`.

This means runtime preview exercises the exported runtime bundle instead of a separate mock path.

## CSP model

The main app keeps a strict CSP in `public/_headers`.

Key main app constraints include:

- `script-src 'self' 'wasm-unsafe-eval'`
- `worker-src 'self' blob:`
- `frame-src 'self'`
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`

Preview documents get a scoped CSP from `public/q2ws-preview-sw.js` responses. That preview CSP keeps compatibility allowances required by preserved qgis2web runtime assets, including inline script and style allowances inside the preview route. The compatibility allowances are scoped to `/preview/{token}/*`, not the main app document.

## Import safety

Import safety lives in `src/lib/fileImport.ts`.

- Folder and ZIP imports are converted into virtual files.
- Paths are normalized by replacing backslashes with forward slashes and trimming leading slashes.
- Path traversal segments such as `..` are rejected.
- Drive prefixes such as `C:/` are rejected.
- Empty normalized paths are rejected.
- File count is capped by `MAX_IMPORT_FILES`, currently 5000 files.
- Unsafe imports raise messages such as `Unsafe import path rejected: ...`.
- Over cap imports raise a smaller export guidance message.

These checks protect the browser side virtual file model and keep pathological ZIP files out of the parser and runtime export paths.

## Runtime export

Static export is built in `src/lib/exportProject.ts`.

- `exportProjectZip()` creates the downloadable ZIP.
- Original qgis2web files are preserved where possible.
- Vector data layers are serialized back into data files after q2webstudio edits.
- Disabled widget assets can be removed from the exported file set.
- The original `index.html` is patched rather than regenerated.
- Export adds `q2ws-config.json` with the q2webstudio runtime configuration.
- Export adds `q2ws-runtime.js` with the runtime overlay.
- Export adds `q2ws-custom.css` with custom styles.

The runtime uses the original qgis2web globals, such as the Leaflet `window.map`, and overlays q2webstudio configuration after the original export boots.

## Raster parity

The current runtime model covers these raster layer kinds across editor preview, runtime preview, and ZIP runtime:

- Image overlay
- WMS tile layers
- PMTiles layers

WMS rendering parity is tile based. WMS GetFeatureInfo click interaction is still deferred.

## Known limits

- WMS GetFeatureInfo is deferred.
- Rule based styling is deferred.
- Custom CRS reprojection is deferred.
- Runtime preview links are local browser routes, not hosted share links.
- The runtime piggybacks the original qgis2web Leaflet export instead of regenerating a full `index.html` from scratch.

## Roadmap boundary

The current architecture is the Audit V4 MVP baseline.

Future work is tracked in [ROADMAP.md](ROADMAP.md).

Large deferred systems each need their own implementation plan before work begins.

## Disclaimer

q2webstudio is an independent editor for qgis2web exports and is not affiliated with qgis2web or OSGeo.
