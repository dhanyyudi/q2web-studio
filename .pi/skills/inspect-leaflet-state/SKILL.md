---
name: inspect-leaflet-state
description: Inspect runtime Leaflet state untuk debugging map kosong, zoom anomali, tile error, atau performance issue. Pakai chrome-devtools MCP untuk forensic detail.
mcp: chrome-devtools
trigger: Bug map terkait runtime, bukan bug build/parse
duration: ~10 menit
---

# Skill, inspect Leaflet state

Tujuan: dig deep ke state Leaflet, event listener, network, dan timing untuk root-cause bug map.

## Kapan dipakai

- Map kosong tapi tidak ada error console.
- Klik layer + zoom in malah balik zoom out (bug Sungai di AUDIT v3 §3.7 dan v3 §4).
- Tile load lambat atau gagal random.
- Memory leak setelah buka/tutup preview berkali-kali.

## Prasyarat

- Chrome instance jalan dengan DevTools terbuka.
- Dev server jalan di port 5173.
- chrome-devtools MCP terkoneksi.

## Langkah

### 1. Connect dan baseline

Via chrome-devtools MCP:

1. `take_snapshot` halaman editor untuk catat state awal.
2. `evaluate_script`:
   ```js
   ({
     loaded: window.__q2ws_map?._loaded,
     center: window.__q2ws_map?.getCenter()?.toString(),
     zoom: window.__q2ws_map?.getZoom(),
     panes: Object.keys(window.__q2ws_map?._panes || {}),
     layerCount: (() => {
       let n = 0;
       window.__q2ws_map?.eachLayer(() => n++);
       return n;
     })()
   })
   ```

### 2. Inspect basemap layer

```js
() => {
  const map = window.__q2ws_map;
  let basemap = null;
  map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) basemap = layer;
  });
  if (!basemap) return { ok: false, reason: "no_tilelayer" };
  return {
    ok: true,
    url: basemap._url,
    options: basemap.options,
    tileCount: Object.keys(basemap._tiles || {}).length,
    bounds: basemap.options.bounds?.toBBoxString(),
    paneZIndex: getComputedStyle(basemap.getPane()).zIndex
  };
}
```

### 3. Trace event flow (untuk bug zoom anomali)

Pasang listener temporary:

```js
() => {
  const map = window.__q2ws_map;
  const log = window.__q2ws_event_log = [];
  ["zoomstart", "zoomend", "zoomanim", "movestart", "moveend",
   "viewreset", "load", "click", "dblclick"].forEach(ev => {
    map.on(ev, e => log.push({ t: Date.now(), ev, zoom: map.getZoom() }));
  });
  return "listeners attached";
}
```

Lakukan aksi yang reproduce bug (klik Sungai, scroll zoom in). Lalu:

```js
() => window.__q2ws_event_log
```

Analisis sequence. Untuk bug zoom Sungai, expect pattern:
- `click` → `zoomstart` (user) → `zoomend` (zoom 13→16) → kemudian `movestart` `moveend` (programmatic fitBounds back) → `zoomstart zoomend` (16→12 by fitBounds).

Jika pattern itu ketemu, bug ada di code yang call `fitBounds` setelah layer click. Lihat AUDIT v3 §3.7 hipotesis A.

### 4. Inspect TerraDraw state

```js
() => {
  if (!window.__q2ws_terra_draw) return { ok: false, reason: "no_terradraw_global" };
  const td = window.__q2ws_terra_draw;
  return {
    started: td._isStarted,
    mode: td.getMode(),
    snapshotCount: td.getSnapshot().length
  };
}
```

(Tambahkan global ini saat debug, gate dengan `import.meta.env.DEV`.)

### 5. Performance trace untuk slow render

Pakai chrome-devtools MCP:

1. `performance_start_trace` (categories: rendering, frame, devtools.timeline).
2. Lakukan aksi yang lambat (import fixture besar, pan map).
3. `performance_stop_trace`.
4. Hasil JSON, cari frame > 50ms.

Untuk fixture Cirebon yang lambat di low zoom, expect simplifikasi kick in (worker call). Cek apakah simplify worker ter-trigger:

```js
() => performance.getEntriesByType("measure").filter(m => m.name.includes("simplify"))
```

### 6. Network forensic

`list_network_requests` filter:

- Tile request: URL match `tile|cartocdn|arcgisonline`. Expect 200, latency < 500ms (production), < 2s (dev).
- Worker request: `studioWorker`. Cek instantiation timing.
- Asset 404: paling sering bug di Phase A (widget vendor path salah).

`get_network_request` untuk request spesifik (dapat headers, response body).

### 7. CORS / COOP check

```js
() => ({
  coop: document.featurePolicy?.allowedFeatures?.()?.includes("cross-origin-isolated"),
  isolated: typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : null,
  opfsAvailable: typeof navigator?.storage?.getDirectory === "function"
})
```

Untuk map render, COOP `same-origin` cukup, COEP **tidak boleh** `require-corp` (regresi v1 audit).

### 8. Memory leak check

Setelah Phase E (preview overlay buka tutup berulang):

1. `take_snapshot` heap awal.
2. Buka tutup preview 10x.
3. `take_snapshot` heap akhir.
4. Diff: cari instance Leaflet map yang tidak di-GC.

```js
() => {
  if (typeof performance.memory === "undefined") return { ok: false };
  return {
    used: (performance.memory.usedJSHeapSize / 1e6).toFixed(1) + " MB",
    total: (performance.memory.totalJSHeapSize / 1e6).toFixed(1) + " MB"
  };
}
```

## Output

- Hasil setiap evaluate_script (raw object) dipasang di issue/PR sebagai bukti.
- Performance trace JSON disimpan di `docs/screenshots/<phase>/perf-<topic>-<YYYYMMDD>.json`.
- Event log dump (step 3) disimpan di `docs/screenshots/<phase>/events-<topic>-<YYYYMMDD>.json`.

## Anti pattern

1. Eksekusi script arbitrary tanpa `() => {...}` wrapper. Selalu wrap di IIFE supaya scope bersih.
2. Tinggal listener yang attached. Selalu remove di akhir investigasi atau reload page.
3. `evaluate_script` yang return DOM node atau circular ref. Return primitive atau plain object only.

## Catatan

- Untuk reproduce bug user yang melaporkan via screenshot, mulai dari step 1 baseline. Bandingkan dengan baseline "good run" yang dicatat saat fitur masih jalan.
- Beberapa bug muncul hanya di StrictMode dev. Test juga dengan `npm run preview` (production build, tanpa StrictMode runtime) untuk konfirmasi prod-only.
