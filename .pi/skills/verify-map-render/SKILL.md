---
name: verify-map-render
description: Verifikasi bahwa map editor render dengan benar setelah import fixture. Pakai setelah perubahan apapun di MapCanvas.tsx, qgis2webParser.ts, atau defaults.ts. Wajib jalan sebelum buka PR untuk fase apapun.
mcp: playwright
trigger: Selesai koding di map path
duration: ~3 menit
---

# Skill, verify map render

Tujuan: deteksi regresi blank map (Bug A + Bug B di AUDIT v3 §3) sebelum PR di-merge.

## Prasyarat

- Dev server di `qgis2web-studio/` belum jalan (skill ini akan start sendiri).
- Fixture tersedia di `../qgis2web_2026_04_22-06_30_44_400659/`.
- StrictMode di [src/main.tsx](../../../src/main.tsx) ON.

## Langkah

### 1. Build clean check

```bash
cd qgis2web-studio
npm run build
```

Expect: exit 0, tidak ada warning baru. Jika gagal, stop di sini.

### 2. Start dev server

```bash
npm run dev
```

Catat URL yang muncul (biasanya http://127.0.0.1:5173).

### 3. Driver via Playwright MCP

Pakai tool MCP `playwright`. Sequence:

1. `browser_navigate` ke `http://127.0.0.1:5173`.
2. `browser_snapshot` untuk dapatkan ref tombol "Import Folder".
3. `browser_file_upload` (atau klik "Import ZIP" jika fixture sudah di-zip) ke fixture path. Untuk folder upload, gunakan helper:
   - Jika browser blok directory picker, fallback: zip dulu fixture dengan `cd .. && zip -r /tmp/fixture.zip qgis2web_2026_04_22-06_30_44_400659`, lalu klik "Import ZIP" dan upload `/tmp/fixture.zip`.
4. `browser_wait_for` untuk teks "Imported 4 layers" muncul, timeout 15 detik.

### 4. Assert map ready

`browser_evaluate` dengan script:

```js
() => {
  const map = window.__q2ws_map;
  if (!map) return { ok: false, reason: "no_map_global" };
  if (!map._loaded) return { ok: false, reason: "not_loaded" };
  const center = map.getCenter();
  const zoom = map.getZoom();
  return { ok: true, center: [center.lat, center.lng], zoom };
}
```

Expect: `ok: true`, center sekitar Cirebon (lat -6.7..-6.9, lng 108.4..108.5), zoom ≥ 10.

Jika `__q2ws_map` belum di-expose, tambahkan di MapCanvas init effect (debug only, gate di balik `import.meta.env.DEV`):

```ts
if (import.meta.env.DEV) {
  (window as any).__q2ws_map = map;
}
```

### 5. Assert tile request fired

`browser_network_requests` filter URL match `arcgisonline.com|cartocdn.com|tile.openstreetmap.org`. Expect: minimal 4 request, status 200.

### 6. Assert layers terlihat di DOM

`browser_evaluate`:

```js
() => {
  const canvas = document.querySelectorAll(".leaflet-canvas-container canvas").length;
  const svgPaths = document.querySelectorAll(".leaflet-overlay-pane svg path").length;
  const markers = document.querySelectorAll(".leaflet-marker-pane > *").length;
  return { canvas, svgPaths, markers, total: canvas + svgPaths + markers };
}
```

Expect: total > 0. Untuk fixture Cirebon (4 layer poligon + line), expect svgPaths atau canvas > 0.

### 7. Console error check

`browser_console_messages` filter level `error`. Expect: array kosong. Warning Leaflet seperti "Tile load timeout" boleh, tapi catat di PR.

### 8. Screenshot

`browser_take_screenshot` full page. Simpan ke `docs/screenshots/phase-X/map-render-<YYYYMMDD>.png`.

### 9. Pan + zoom regression

Test interaktif:

1. `browser_evaluate` simulate scroll wheel zoom in 3 step:
   ```js
   () => {
     const map = window.__q2ws_map;
     map.zoomIn(3);
     return { zoom: map.getZoom() };
   }
   ```
2. `browser_wait_for` 1 detik.
3. Cek tile request baru di network log.

### 10. Selected layer toggle

1. Klik radio "Selected layer".
2. Expect: hanya layer terpilih terlihat. Lainnya hilang dari DOM (pane child count drop).

### 11. ZIP export sanity

Optional, tapi recommended di Phase 0/1: klik tombol "Export ZIP", tunggu unduh, lalu jalankan skill [verify-runtime-export.md](verify-runtime-export.md).

## Output yang harus dikumpulkan

- Screenshot full page hasil import.
- Console log (kosong dari error).
- Network log filter tile request (HAR atau dump JSON).
- Hasil `browser_evaluate` step 4 dan 6 (raw object).

Pasang di PR description sebagai bukti.

## Failure mode dan triage

| Gejala | Hipotesis | Cek |
|---|---|---|
| `__q2ws_map._loaded === false` | Map init tanpa center/zoom (Bug A) | Grep `L.map(` di MapCanvas.tsx, cek opsi |
| `_loaded === true` tapi tile 0 request | Basemap URL salah atau CORS | Cek `project.basemaps[*].url`, cek Network 4xx |
| Tile request 200 tapi layer SVG 0 | autofit tidak jalan (Bug B) | Cek `lastAutoFitKeyRef` reset di init effect |
| StrictMode mount kedua bikin blank | Refs persist, fitBounds skip | Tambah reset semua ref di init effect body |

## Catatan

- Skill ini juga jadi basis Playwright e2e gate yang dipasang di CI (lihat AUDIT v3 §8.3).
- Update skill ini jika ada flow baru setelah Phase 1 split MapCanvas (referensi hook baru).
