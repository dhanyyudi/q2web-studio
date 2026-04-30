# qgis2web Studio

[![Support](https://img.shields.io/badge/Support-tiptap.gg-ff6b6b?style=for-the-badge)](https://tiptap.gg/dhanypedia)

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=111&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=fff&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=fff&style=flat-square)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=fff&style=flat-square)
![Terra Draw](https://img.shields.io/badge/Terra_Draw-1.28-0f766e?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

Browser first, local first editor for qgis2web Leaflet exports.

## Status

Active development. Leaflet exports are supported. OpenLayers exports are not supported yet.

## Main Features

- Import qgis2web Leaflet folders and ZIP files.
- Detect `index.html`, `data/*.js`, layer metadata, popup fields, styles, labels, basemaps, and selected original widgets.
- Preview imported maps with Leaflet.
- Edit branding, title, subtitle, footer, welcome modal, theme, header placement, footer placement, and logo placement.
- Edit basemap settings and layer visibility.
- Edit layer styles, including fill, stroke, opacity, width, dash arrays, point radius, category colors, and legend symbols.
- Edit popup templates, popup fields, and popup styling.
- Edit labels for supported layers.
- Edit GeoJSON attributes in a table.
- Add, rename, and delete attribute fields.
- Add and edit simple geometry with Terra Draw for `Point`, `LineString`, and `Polygon` layers.
- Render multi geometry layers in preview mode.
- Add text annotations as GeoJSON point features.
- Export a static ZIP with runtime files.

## Current Limitations

- Only qgis2web Leaflet exports are supported.
- Direct vertex editing is limited to simple `Point`, `LineString`, and `Polygon` geometries.
- `MultiPoint`, `MultiLineString`, and `MultiPolygon` layers can be rendered, styled, and edited in the attribute table, but direct geometry editing is still planned.
- The exported runtime still depends on the original qgis2web `index.html` and layer globals.
- The editor is still being refactored according to the audit notes in `docs/AUDIT-2026-04-29-v3.md`.

## How Export Works

qgis2web Studio keeps the original qgis2web folder structure and adds a small runtime layer:

```text
q2ws-config.json
q2ws-runtime.js
q2ws-custom.css
```

Edited `data/*.js` files are written back in the qgis2web compatible pattern:

```js
var json_LayerName_1 = { ...GeoJSON... };
```

The exported folder remains a static web map. You can serve it with a local static server or deploy it to static hosting.

## Development

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run parser smoke tests:

```bash
npm run smoke:fixture
```

Run the Playwright map render smoke test:

```bash
npm run smoke:map
```

The fixture used by smoke tests is stored in:

```text
docs/example_export/qgis2web_2026_04_22-06_30_44_400659
```

## Browser Notes

The app uses Web Workers for parsing and heavy file work. It also uses the Origin Private File System when available for local browser cache.

The Vite dev server sends cross-origin isolation headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

That allows browsers to expose `SharedArrayBuffer` when supported. SharedArrayBuffer is an optimization, not a requirement.

## Project Notes

Important implementation notes and phase plans are documented in:

```text
AGENTS.md
docs/AUDIT-2026-04-29-v3.md
docs/QA-CHECKLIST-PER-PHASE.md
```

## License

This project is licensed under the MIT License.

See `LICENSE` for details.
