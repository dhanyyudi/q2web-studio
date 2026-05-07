---
name: verify-runtime-export
description: Verifikasi ZIP export dapat di-serve via static HTTP server dan render dengan benar. Pakai setelah perubahan runtime.ts, exportProject.ts, runtimePreview.ts, atau widget bundling.
mcp: playwright
trigger: Selesai koding di runtime/export path
duration: ~5 menit
---

# Skill, verify runtime export

Tujuan: pastikan hasil ZIP yang di-download user bisa dibuka dan menampilkan map plus widget yang dipilih, identik dengan editor preview.

## Prasyarat

- Dev server jalan, fixture sudah di-import.
- `python3 -m http.server` tersedia (default di macOS dan Linux).
- Port 8765 free.

## Langkah

### 1. Trigger export di studio

Via Playwright MCP:

1. `browser_navigate` ke editor.
2. Pastikan project sudah ter-import dari fixture (jika belum, jalankan dulu skill verify-map-render).
3. `browser_click` tombol "Export ZIP".
4. Tunggu unduhan selesai. Default Chrome download path.

Atau via headless Playwright dengan `download` listener:

```js
const downloadPromise = page.waitForEvent("download");
await page.click("text=Export ZIP");
const download = await downloadPromise;
const path = await download.path();
```

### 2. Ekstrak ke folder kerja

```bash
DEST=/tmp/q2ws-export-$(date +%s)
unzip -q "$DOWNLOAD_PATH" -d "$DEST"
ls "$DEST"
```

Expect: minimal `index.html`, `q2ws-runtime.js`, `q2ws-config.json`, folder `data/`, folder `vendor/` (jika widget enabled).

### 3. Validasi struktur ZIP

```bash
test -f "$DEST/index.html" || echo "MISSING index.html"
test -f "$DEST/q2ws-runtime.js" || echo "MISSING runtime"
test -f "$DEST/q2ws-config.json" || echo "MISSING config"
ls "$DEST/data/" | wc -l           # expect 4 (BatasDesa, ZNT, Sungai, JaringanJalan)
```

Untuk Phase A (widget preserved), cek ekstra:

```bash
test -d "$DEST/vendor/leaflet-measure" || echo "MISSING measure"
test -d "$DEST/vendor/leaflet.photon" || echo "MISSING photon"
```

Adjust sesuai widget yang user enable.

### 4. Serve via static HTTP

```bash
cd "$DEST" && python3 -m http.server 8765 &
SERVER_PID=$!
sleep 1
```

Catatan: file:// protocol blok beberapa fitur Leaflet (CORS, JSON fetch). Wajib pakai HTTP server.

### 5. Open via Playwright MCP

1. `browser_navigate` ke `http://127.0.0.1:8765/index.html`.
2. `browser_wait_for` window load + 2 detik settle.

### 6. Assert widget aktif (untuk Phase A+)

`browser_evaluate`:

```js
() => {
  return {
    measure: !!document.querySelector(".leaflet-control-measure"),
    photon: !!document.querySelector(".leaflet-control-photon"),
    layers: !!document.querySelector(".leaflet-control-layers"),
    zoom: !!document.querySelector(".leaflet-control-zoom"),
  };
}
```

Expect: sesuai daftar widget yang enabled di studio. Jika user matikan measure, expect `measure: false`.

### 7. Assert layer dan label

```js
() => {
  const map = window.map; // qgis2web standard global
  if (!map) return { ok: false, reason: "no_map" };
  let layerCount = 0;
  map.eachLayer(() => layerCount++);
  const labels = document.querySelectorAll(".leaflet-tooltip-pane > *").length;
  const features = document.querySelectorAll(".leaflet-overlay-pane path").length;
  return {
    ok: true,
    zoom: map.getZoom(),
    center: [map.getCenter().lat, map.getCenter().lng],
    layerCount,
    labels,
    features
  };
}
```

Expect: `layerCount` sesuai (tile + 4 layer + control panes), `labels > 0` jika label NAMOBJ enabled, `features > 0`.

### 8. Test popup

1. `browser_click` di salah satu polygon ZNT (gunakan koordinat dari `browser_snapshot` atau `browser_evaluate` untuk dapat bbox).
2. `browser_wait_for` `.leaflet-popup` muncul.
3. `browser_evaluate` cek isi popup:
   ```js
   () => document.querySelector(".leaflet-popup-content")?.innerText
   ```
   Untuk fixture ZNT, expect berisi "Kabupaten/Kota", "Kab. Cirebon", "Kisaran Nilai Tanah", "Tahun Data".

### 9. Test interaksi widget

Untuk measure (jika enabled):

1. `browser_click` tombol measure (ikon ruler).
2. Klik 2 titik di map.
3. Expect: jarak terhitung muncul di control.

Untuk photon search:

1. `browser_type` query "Sumber, Cirebon" di search input.
2. `browser_wait_for` dropdown result.
3. Klik result pertama.
4. Expect: map pan ke koordinat result.

### 10. Console + network sanity

- `browser_console_messages` filter `error`. Expect kosong.
- `browser_network_requests` cek 404. Expect tidak ada (terutama untuk asset di vendor/).

### 11. Screenshot

`browser_take_screenshot`. Simpan ke `docs/screenshots/phase-X/runtime-export-<YYYYMMDD>.png`.

### 12. Cleanup

```bash
kill $SERVER_PID 2>/dev/null
rm -rf "$DEST"
```

## Output

- Screenshot runtime
- JSON hasil step 6 (widget map) dan step 7 (layer info)
- Konsol bersih
- ZIP file size (catat di PR, kalau > 10 MB jelaskan kenapa)

## Failure mode dan triage

| Gejala | Hipotesis | Cek |
|---|---|---|
| `index.html` tidak load di Playwright | Path asset relatif salah | Buka source view, cek `<script src=...>` |
| `window.map` undefined | qgis2web original index.html tidak boot | Cek apakah Studio override `index.html` (anti-pattern) |
| Widget hilang meski enabled di studio | exportProject.ts skip copy asset | Grep `widgets.forEach` di exportProject.ts |
| Label hilang | runtime.ts `applyLayerPopupAndLabels` tidak terpanggil | Cek q2ws-config.json, field `label` per layer |
| Tile 4xx | Basemap URL HTTPS issue, atau attribution salah | Cek q2ws-config.json basemaps |
| Popup default Studio bukan original | popupTemplate.mode bukan "original" | Cek parser parsePopupTemplates |

## Catatan

- ZIP yang dihasilkan harus self-contained, bisa dibuka offline kecuali tile basemap (yang memang remote).
- Untuk demo offline, dokumentasikan cara cache tile (out-of-scope MVP).
