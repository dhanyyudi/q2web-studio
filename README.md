# q2webstudio

[![Support](https://img.shields.io/badge/Support-tiptap.gg-ff6b6b?style=for-the-badge)](https://tiptap.gg/dhanypedia)

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=111&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=fff&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=fff&style=flat-square)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=fff&style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

Browser first, local first editor for qgis2web Leaflet exports.

## What it does

q2webstudio helps you import an existing qgis2web Leaflet export, customize it visually, then export a refreshed static web map.

## Main features

- Import qgis2web Leaflet folders and ZIP files
- Preview maps directly in the browser
- Edit branding, header, footer, and welcome content
- Adjust basemaps and layer visibility
- Edit map styles, labels, legends, and popup content
- Edit GeoJSON attributes in a table
- Add and edit simple geometry for points, lines, and polygons
- Export back to a static ZIP

## Limitations

- Only qgis2web Leaflet exports are supported
- OpenLayers exports are not supported yet
- Direct geometry editing is limited to simple `Point`, `LineString`, and `Polygon`
- Multi geometry layers can be previewed and managed, but direct geometry editing is still limited

## Quick start

```bash
npm install
npm run dev
```

Then open the local app in your browser and import your qgis2web export.

## License

This project is licensed under the MIT License.

See `LICENSE` for details.
