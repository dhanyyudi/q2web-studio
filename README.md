# qgis2web Studio

qgis2web Studio is a browser-first, local-first editor for qgis2web Leaflet exports. It lets non-programmer GIS users drag in an exported qgis2web folder, adjust the web map visually, edit attributes and simple geometry, then export a modified static web map without sending data to a server.

## What It Does

- Imports qgis2web Leaflet folders from the browser.
- Detects `index.html`, `data/*.js`, layer metadata, popup fields, and basic style information.
- Previews the map with Leaflet.
- Edits map branding such as title, subtitle, footer, theme color, and visibility of UI panels.
- Edits layer labels, layer visibility, popup availability, legend availability, and layer control visibility.
- Edits spatial styles including fill color, stroke color, opacity, stroke width, point radius, dash arrays, and category colors.
- Generates an HTML legend from the editable style manifest, so legend colors stay aligned with map colors.
- Edits GeoJSON attribute values in a table.
- Adds, renames, and deletes attribute fields.
- Adds and edits simple geometry through Terra Draw for `Point`, `LineString`, and `Polygon`.
- Adds text annotations as GeoJSON point features.
- Exports a static ZIP with low-code runtime files.

## Current Scope

The first version focuses on qgis2web Leaflet exports. OpenLayers exports are not supported yet.

Geometry editing currently targets simple `Point`, `LineString`, and `Polygon` features. `MultiPoint`, `MultiLineString`, and `MultiPolygon` features can still be rendered, styled, and edited in the attribute table, but direct vertex editing for multi geometries is planned for a later version.

## How The Export Works

qgis2web Studio keeps the original qgis2web folder structure and adds a small runtime layer:

```text
q2ws-config.json
q2ws-runtime.js
q2ws-custom.css
```

The app rewrites edited `data/*.js` files so the output stays compatible with the qgis2web pattern:

```js
var json_LayerName_1 = { ...GeoJSON... };
```

The exported folder remains a static web map. It can be opened locally with a static server or deployed to GitHub Pages, Netlify, Vercel, or another static hosting service.

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

Run the fixture smoke test:

```bash
npm run smoke:fixture
```

The smoke test expects the training fixture folder to exist beside this project:

```text
../qgis2web_2026_04_22-06_30_44_400659
```

## Browser Notes

The app uses Web Workers for parsing and heavy file work. It also uses the Origin Private File System when available for local browser cache.

The Vite dev server sends cross-origin isolation headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

That allows browsers to expose `SharedArrayBuffer` when supported. SharedArrayBuffer is an optimization, not a requirement.

## Repository Topics

Recommended GitHub topics:

```text
qgis
qgis2web
leaflet
webgis
geojson
gis
low-code
spatial-data
terra-draw
browser-editor
```

## License

No license has been selected yet.
