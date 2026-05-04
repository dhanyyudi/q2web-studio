# Manual QA Checklist — Per Phase (companion to AUDIT-v3)

> Pakai dokumen ini setiap kali Codex menyerahkan hasil fase. Setiap fase punya 4 bagian: **Pre-flight**, **Functional checks**, **Regression checks** (fase sebelumnya tetap jalan), dan **Acceptance gate** (yang harus lulus untuk approve PR).
>
> Fixture utama: `qgis2web_2026_04_22-06_30_44_400659/` (folder atau hasil ZIP dari Cirebon ZNT).
> Browser utama: Chrome dengan DevTools terbuka (Console + Network tab) untuk semua tes.
> Mode dev: **biarkan React.StrictMode tetap ON** di [src/main.tsx](../src/main.tsx). Jika Codex mematikan StrictMode untuk "memperbaiki" sesuatu, **reject PR**.

---

## Cheat-sheet: setup ulang setiap kali sebelum tes

```bash
cd qgis2web-studio
git status                          # pastikan branch Codex sudah checkout
npm install                         # jika package.json berubah
npm run build                       # harus exit 0 tanpa warning baru
npm run smoke:fixture               # harus pass
npm run dev                         # buka di port yang muncul (biasanya 5173)
```

Di Chrome:

1. DevTools → Application → Storage → **Clear site data** (hapus OPFS lama yang bisa bikin crash).
2. DevTools → Console: aktifkan `Preserve log`.
3. Hard reload (Cmd+Shift+R).

Untuk uji ZIP export:

```bash
# Setelah klik "Export ZIP" di studio, ekstrak ke folder sementara
unzip -q ~/Downloads/<nama>.zip -d /tmp/q2ws-export
cd /tmp/q2ws-export && python3 -m http.server 8765
# Buka http://127.0.0.1:8765/index.html (jangan double-click index.html — file:// blok beberapa fitur)
```

Selalu uji **dua jalur** untuk fase apapun yang menyentuh runtime: editor preview **DAN** hasil ZIP yang dijalankan via `python3 -m http.server`.

---

## Phase 0 — Hotfix: blank map (paling kritis)

**Tujuan PR:** map muncul lagi setelah import. Hanya itu. Tidak ada fitur baru.

### 0.1 Pre-flight

- [ ] `git diff --stat` hanya menyentuh: `MapCanvas.tsx`, `qgis2webParser.ts`, `opfs.ts` (+ test smoke baru). Jika lebih dari itu → tanya Codex kenapa scope membengkak.
- [ ] [src/main.tsx](../src/main.tsx) **masih** memakai `<React.StrictMode>`.
- [ ] `L.map(container, ...)` di MapCanvas.tsx sekarang punya `center` dan `zoom`. Grep:
  ```bash
  grep -n "L.map(" src/components/MapCanvas.tsx
  ```
  → harus terlihat `center: [...]` + `zoom: ...` di opsi.
- [ ] `lastAutoFitKeyRef.current = ""` (atau setara) ada di awal init useEffect, **bukan hanya di cleanup**. Grep:
  ```bash
  grep -n "lastAutoFitKeyRef\|userMovedMapRef\|programmaticMoveRef\|tileErrorShownRef" src/components/MapCanvas.tsx
  ```

### 0.2 Functional checks

1. **Import fixture berhasil dan map muncul**
   - [ ] Klik **Import Folder** → pilih `qgis2web_2026_04_22-06_30_44_400659`.
   - [ ] Toast hijau "Imported 4 layers" muncul.
   - [ ] **Basemap tile** (Esri Imagery) tampil sebagai background satelit dalam 3 detik.
   - [ ] **4 layer** terlihat: Batas Desa (poligon outline putih), Zona Nilai Tanah (poligon warna-warni), Sungai (garis biru), Jaringan Jalan (garis kuning/abu-abu).
   - [ ] Map otomatis zoom ke Cirebon (sekitar lng=108.47, lat=-6.78).
   - [ ] Console **bersih** (tidak ada error merah; warning Leaflet biasa OK).

2. **Pan + zoom**
   - [ ] Drag map → ikut bergerak halus, tile baru ter-load.
   - [ ] Scroll wheel zoom in 3 langkah → tile detil termuat, tidak balik zoom out.
   - [ ] Klik tombol +/- di kanan-bawah → zoom berubah, tile reload.

3. **Layer display toggle**
   - [ ] Klik "Selected layer" → hanya layer yang dipilih tetap terlihat.
   - [ ] Klik "All layers" → semua kembali muncul.

4. **Pilih layer multi-geometri (Batas Desa atau Zona Nilai Tanah)**
   - [ ] Banner "Multi-geometry layer is preview-only..." muncul.
   - [ ] Map **tetap terlihat** (poligon Batas Desa terrender, basemap masih ada). Inilah bug awal — pastikan tidak balik.

5. **Basemap dropdown label rapi**
   - [ ] Project Settings → Map View → Basemap. Pilihan: "Esri Imagery", "Carto Voyager" — **tanpa** prefix `"layer "`.

6. **OPFS migration aman**
   - [ ] Setelah import berhasil, refresh halaman (Cmd+R, bukan hard reload). Project ter-restore dari OPFS, map kembali ter-render. Tidak ada error console seperti `Cannot read properties of undefined (reading 'map')` dari `project.basemaps` atau `project.runtime`.

7. **Export ZIP — runtime juga harus render**
   - [ ] Klik **Export ZIP**. ZIP terunduh.
   - [ ] Ekstrak + serve via `python3 -m http.server 8765` (jangan `file://`).
   - [ ] Buka `http://127.0.0.1:8765/index.html` — basemap + 4 layer terlihat sama seperti di editor.

### 0.3 Regression checks (Sprint 1–5 sebelumnya tetap jalan)

- [ ] Tile error toast tetap muncul jika basemap diganti ke URL palsu (uji: edit `defaults.ts` sementara, atau matikan koneksi ke server.arcgisonline.com via DevTools → Network → block request URL pattern).
- [ ] Inspector tab gating: tidak ada layer terpilih → muncul Branding + Map. Layer terpilih → muncul Layer/Style/Popup/Legend.
- [ ] Preview button (ikon mata di topbar) tetap membuka overlay full-screen.
- [ ] Attribute table tetap muncul (panel bawah).
- [ ] Geometry-aware Style fields: layer point hanya tampilkan pointRadius; layer line tidak.

### 0.4 Acceptance gate

- [ ] CI hijau: `npm run build` + `npm run smoke:fixture`.
- [ ] **Playwright smoke baru** (atau equivalent) ada di `tests/` atau `e2e/` dan pass:
  - Import fixture.
  - Tunggu `window.__q2ws_map?._loaded === true`.
  - Assert basemap tile request fired (URL match `arcgisonline.com` atau `cartocdn.com`).
  - Assert minimal satu `<path>` SVG / canvas element tergambar di overlay pane.
  - Assert console error count = 0.
- [ ] PR description berisi **2 screenshot**: editor preview + ZIP export.
- [ ] PR title format: `fix(map): restore rendering after import (StrictMode-safe init)`.

**Jika gagal salah satu di 0.2 atau 0.4 → reject PR. Hotfix tidak boleh ditumpangi fitur baru.**

---

## Phase 1 — Stabilise & split MapCanvas

**Tujuan PR:** refactor `MapCanvas.tsx` jadi hooks (`useLeafletMap`, `useBasemap`, `useGeoJsonLayers`, `useTerraDrawEditor`, `useAutoFit`). Tidak boleh ada fitur baru.

### 1.1 Pre-flight

- [ ] [src/components/MapCanvas.tsx](../src/components/MapCanvas.tsx) sekarang **< 300 baris**.
- [ ] Folder baru `src/components/map/` atau `src/hooks/map/` berisi minimal 5 file hook.
- [ ] Setiap hook mengekspos `mapInstanceVersion` atau pattern serupa untuk StrictMode safety.
- [ ] `git diff` hanya kode (tidak ada perubahan UI di App.tsx selain prop wiring).

### 1.2 Functional checks (semua = Phase 0 + edge cases)

1. **Semua check Phase 0 ulang** (1–7 di §0.2). Wajib 100%.
2. **Edge case — buka studio tanpa import**
   - [ ] Empty state muncul (drop card "Import qgis2web export").
   - [ ] Tidak ada error console.
3. **Edge case — pilih layer kemudian hapus seluruh project lalu import lagi**
   - [ ] Map mounting/unmounting tidak meninggalkan instance Leaflet stray. Buka DevTools → `window.__q2ws_map._container` — masih sesuai map terkini.
4. **Toggle preview mode → editor mode → preview mode**
   - [ ] TerraDraw lifecycle bersih (tidak ada double init, tidak ada warning "TerraDraw is already started").
5. **Resize window beberapa kali**
   - [ ] `invalidateSize` ter-trigger; tile re-load tanpa abu-abu permanen.

### 1.3 Regression checks

- [ ] Sprint 2 clustering: import fixture besar (>500 point) → marker cluster terlihat (jika tidak ada fixture besar, skip dengan catatan).
- [ ] Sprint 2 simplifikasi: zoom ke level rendah → poligon ter-simplify (visual: garis lebih kasar pada zoom <8).
- [ ] Header overlay editor (warna teal #156f7a) tetap di atas map.
- [ ] Basemap dropdown ganti basemap → tile baru muncul, basemap lama hilang (tidak menumpuk).

### 1.4 Acceptance gate

- [ ] Build, smoke, Playwright dari Phase 0 tetap pass.
- [ ] Tambahkan unit test untuk hook `useAutoFit`: dengan refs di-mock, expect `fitBounds` dipanggil pada mount kedua dengan key sama (StrictMode regression test).
- [ ] PR title: `refactor(map): split MapCanvas into single-concern hooks`.

---

## Phase A — Faithfulness Import (widget, basemap, label, popup HTML asli)

**Tujuan PR:** hasil import = mirror originalitas qgis2web export. User modify opsional.

### A.1 Pre-flight

- [ ] Dependensi baru di `package.json`: `dompurify`, `leaflet-measure`, `leaflet.photon`, `leaflet-fullscreen`, `leaflet-hash` (atau equivalents).
- [ ] Folder `vendor/` atau setara muncul dalam ZIP export untuk asset widget.
- [ ] `Qgis2webProject.runtime.widgets[]` dan `LayerConfig.label`, `LayerConfig.popupTemplate` ada di tipe.

### A.2 Functional checks — editor

1. **Widget terdeteksi otomatis dari original**
   - [ ] Import fixture → Project Settings → tab Widgets → **Measure tool, Address search, Layer tree control, Permanent labels** semuanya tercentang (terdeteksi).
   - [ ] Map editor menampilkan: tombol measure (ikon ruler) di kiri-atas, search bar Photon di area khusus, tooltip label NAMOBJ permanen di tengah tiap polygon Batas Desa.

2. **Toggle widget off**
   - [ ] Uncheck "Measure tool" → tombol ruler hilang dari editor preview seketika.
   - [ ] Uncheck "Permanent labels" → tooltip NAMOBJ hilang.

3. **Basemap CRUD**
   - [ ] Project Settings → Basemaps → list 2 basemap (Carto Voyager, Esri Imagery). Default tertanda.
   - [ ] Klik **Add basemap** → form: label, URL template, attribution, max zoom. Submit → muncul di list dan di dropdown.
   - [ ] Drag-reorder basemap → urutan dropdown ikut.
   - [ ] Hapus basemap default → konfirmasi dialog; pilih default baru terlebih dulu.
   - [ ] Refresh halaman → basemap user-added tersimpan via OPFS.

4. **Layer label config**
   - [ ] Pilih layer Batas Desa → tab Layer → section Labels.
   - [ ] Field dropdown: NAMOBJ (terdeteksi), bisa diganti ke WADMKC.
   - [ ] Toggle Permanent → label hilang/muncul real-time.
   - [ ] Offset XY input → label bergeser.

5. **Popup template chooser**
   - [ ] Pilih layer ZNT → tab Popup → radio: **Original HTML**, Field grid, Custom.
   - [ ] Default = Original HTML (karena fixture mengandung `pop_ZonaNilaiTanah_4` template).
   - [ ] Klik fitur ZNT → popup tampil dengan layout asli: header "Kabupaten/Kota" → "Kab. Cirebon" diikuti "Kisaran Nilai Tanah (Rp/m2)" + nilai, "Tahun Data" + tahun. **Tidak** layout table grid generic studio.
   - [ ] Switch ke Field grid → popup berubah ke layout grid.
   - [ ] Switch ke Custom → textarea muncul dengan template Mustache; ubah `{{NAMOBJ}}` → preview live update.

### A.3 Functional checks — ZIP export

- [ ] Export ZIP, ekstrak, serve via `python3 -m http.server`.
- [ ] Buka `index.html`:
  - [ ] Tombol measure di kiri-atas → klik → bisa ukur jarak.
  - [ ] Search bar Photon di posisi original → ketik "Sumber, Cirebon" → marker muncul.
  - [ ] Layer toggle tree (hierarchical) di kanan-atas → bisa nyalakan/matikan layer.
  - [ ] Label NAMOBJ permanen di setiap polygon Batas Desa.
  - [ ] Popup ZNT pakai layout asli.
- [ ] Ukuran ZIP tidak balon ekstrim (< 5 MB untuk fixture). Jika > 10 MB → cek apakah ada asset duplikat.
- [ ] Toggle measure off di editor → re-export → ZIP tidak berisi `vendor/leaflet-measure/*` dan `index.html` tidak include script-nya.

### A.4 Regression checks

- [ ] Phase 0 + Phase 1 checks ulang.
- [ ] Toggle off **semua** widget → editor masih render map normal (hanya kehilangan tools).
- [ ] Layer dengan `popupTemplate.mode === "field-grid"` (jika ada layer tanpa pop_* function) tetap render layout grid studio.

### A.5 Acceptance gate

- [ ] Smoke test baru: assert ZIP berisi `index.html` yang me-load `vendor/leaflet-measure/leaflet-measure.css` saat measure enabled, dan tidak me-load saat disabled.
- [ ] Screenshot PR: editor + ZIP runtime, side-by-side.

---

## Phase 8 — Raster parity, image overlay, WMS, PMTiles

### 8.1 Pre-flight

- [ ] `npm install` sudah dijalankan jika `package.json` berubah.
- [ ] `npm run build` harus pass.
- [ ] `npm run smoke:fixture` harus pass.
- [ ] `npm run smoke:export` harus pass.
- [ ] Fixture raster tersedia:
  - `docs/example_export/qgis2web_raster_image_overlay.zip`
  - `docs/example_export/qgis2web_raster_wms.zip`
  - `docs/example_export/qgis2web_raster_pmtiles.zip`

### 8.2 Functional checks, editor

1. **Image overlay**
   - [ ] Import `qgis2web_raster_image_overlay.zip`.
   - [ ] Status menunjukkan `Imported 2 layers`.
   - [ ] Overlay image tampil di map editor.
   - [ ] Side panel menampilkan layer raster dan layer vector.
   - [ ] Klik layer raster, inspector raster muncul.
   - [ ] Ubah opacity raster, preview ikut berubah.
   - [ ] Toggle visibility raster, overlay hilang lalu muncul lagi.

2. **WMS**
   - [ ] Import `qgis2web_raster_wms.zip`.
   - [ ] Inspector raster muncul untuk layer WMS.
   - [ ] Layer WMS tetap punya source summary URL dan layer name.
   - [ ] Network memperlihatkan request WMS tile saat layer visible.
   - [ ] Toggle visibility WMS mematikan lalu menyalakan request layer.

3. **PMTiles**
   - [ ] Import `qgis2web_raster_pmtiles.zip`.
   - [ ] Inspector raster muncul untuk layer PMTiles.
   - [ ] Source summary menunjukkan path PMTiles.
   - [ ] Runtime dependency `pmtiles.js` tersedia untuk export path.
   - [ ] Jika fixture PMTiles hanya placeholder parser parity, catat bahwa render visual final masih tergantung tileset valid.

### 8.3 Functional checks, ZIP export

- [ ] Export ZIP dari fixture image overlay.
- [ ] Serve via `python3 -m http.server`.
- [ ] Runtime ZIP menampilkan raster image overlay.
- [ ] `q2ws-config.json` menyimpan `raster-image` dengan `imagePath` runtime-relative.
- [ ] Export ZIP dari fixture WMS menyimpan `raster-wms` config utuh.
- [ ] Export ZIP dari fixture PMTiles menyimpan `raster-pmtiles` config utuh.
- [ ] ZIP PMTiles menyertakan `js/pmtiles.js` bila runtime butuh file tersebut dari export preserved assets.

### 8.4 Regression checks

- [ ] Fixture vector utama tetap import normal.
- [ ] Style mode vector `single`, `categorized`, `graduated` tidak regress.
- [ ] Preview route Phase 6 tetap bisa dibuka.
- [ ] Export ZIP vector baseline tetap lolos smoke export.

### 8.5 Acceptance gate

- [ ] `npm run build` pass.
- [ ] `npm run smoke:fixture` pass.
- [ ] `npm run smoke:export` pass.
- [ ] `npx playwright test tests/map-render.spec.ts -g "phase 8 raster"` pass.
- [ ] Evidence folder Phase 8 berisi log build, smoke fixture, smoke export, Playwright, editor screenshot, runtime preview screenshot, runtime screenshot, console log, dan network log.
- [ ] PR description mencantumkan parity sweep editor, runtime preview, dan ZIP runtime, serta tag `@codex`.

## Phase 9 — Diagnostics, layer search, and post-merge gap closure

- [ ] Layer search filters visible rows in the side panel.
- [ ] Diagnostics panel stays visible when parser warnings exist.
- [ ] Exported WMS runtime performs served browser requests.
- [ ] Exported PMTiles runtime fetches `sample.pmtiles` when served.
- [ ] Phase 7 style mode tests still pass.
- [ ] Phase 8 raster tests still pass.

### 9.1 Acceptance and evidence bundle

- [ ] Editor screenshot is attached under `docs/screenshots/phase-9/`.
- [ ] ZIP runtime screenshot is attached under `docs/screenshots/phase-9/`.
- [ ] Build log is attached under `docs/screenshots/phase-9/`.
- [ ] Smoke fixture log is attached under `docs/screenshots/phase-9/`.
- [ ] Smoke export log is attached under `docs/screenshots/phase-9/`.
- [ ] Playwright phase 7, 8, and 9 log is attached under `docs/screenshots/phase-9/`.

WMS GetFeatureInfo remains deferred after Phase 9 review because the current imported fixture and runtime config preserve tile rendering parity, but do not yet carry a bounded, testable click-info contract without widening scope into a larger runtime interaction redesign.

## Phase B — Inspector UX (welcome, header/footer variants, sidebar, per-layer popup style)

### B.1 Pre-flight

- [ ] Tipe `WelcomeSettings`, `HeaderPlacement`, `FooterPlacement`, `SidebarSettings`, `LayerConfig.popupSettings` ada.
- [ ] Dependensi baru: `marked`, `dompurify` (untuk markdown sidebar).

### B.2 Functional checks

1. **Welcome modal editor**
   - [ ] Project Settings → Welcome → toggle Enabled → field Title, Subtitle (markdown), CTA, Image upload, Auto-dismiss (never/3/5/10), Show once, Placement (center/bottom).
   - [ ] Edit Title "Selamat datang di Cirebon" → simpan → preview map awalnya tertutup welcome modal.
   - [ ] Klik CTA → modal hilang.
   - [ ] Set Auto-dismiss = 3s → reload → modal hilang sendiri setelah 3 detik.
   - [ ] Set Show once = ON → reload → modal **tidak** muncul lagi.
   - [ ] Clear localStorage `q2ws-welcome-dismissed-*` → modal muncul lagi.
   - [ ] Subtitle markdown `**bold**` → render bold.
   - [ ] Subtitle berisi `<script>alert(1)</script>` → tidak ter-eksekusi (DOMPurify menyaring).
   - [ ] Pengulangan di ZIP runtime: behavior identik.

2. **Header/footer placement**
   - [ ] Header placement: top-full → ribbon penuh; top-left-pill → pill di kiri-atas; top-right-pill → kanan-atas; top-center-card → kartu di tengah-atas; hidden → header hilang.
   - [ ] Saat `top-left-pill` → tombol measure (kiri-atas) **tidak tertimpa**. Jika tertimpa → flag bug ke Codex.
   - [ ] Sama untuk Footer placement: bottom-full / bottom-left-pill / bottom-right-pill / hidden.
   - [ ] Logo placement (left/center/right/hidden) tetap berfungsi di setiap header variant.
   - [ ] ZIP runtime: tiap variant render identik dengan editor.

3. **Sidebar**
   - [ ] Project Settings → Sidebar → toggle ON. Field: Side (left/right), Width (px), Markdown content textarea.
   - [ ] Side = right, Width = 360 → map menyusut ke kiri, sidebar muncul kanan dengan markdown ter-render.
   - [ ] Markdown `# Tentang peta\n- Sumber: BPN\n- Tahun: 2026` → render heading + list.
   - [ ] Sidebar `<script>` ter-strip.
   - [ ] Toggle OFF → sidebar hilang, map ekspan kembali full.

4. **Per-layer popup styling override**
   - [ ] Pilih layer Batas Desa → tab Popup → section Style → toggle "Use project default" OFF.
   - [ ] Set Accent = #1976d2 (biru). Layer ZNT pakai accent project default (teal).
   - [ ] Klik fitur Batas Desa → popup beraccent biru. Klik fitur ZNT → popup beraccent teal. Visual berbeda jelas.
   - [ ] ZIP runtime: tetap berbeda.

### B.3 Regression checks

- [ ] Semua Phase 0/1/A jalan.
- [ ] Welcome dengan `enabled: false` (default lama) → modal tidak muncul.
- [ ] Project lama (sebelum Phase B) ter-load tanpa crash; field welcome/sidebar default ke OFF.

### B.4 Acceptance gate

- [ ] Test sanitization: input markdown sidebar `<script>...` tidak boleh masuk DOM. Snapshot test atau e2e.
- [ ] Screenshot tiap variant header/footer (minimal 4 + 3 = 7 screenshot di PR).

---

## Phase C — Layer toggle vs Legend semantics

### C.1 Pre-flight

- [ ] `MapSettings.layerControlMode ∈ {compact, expanded, tree}`. Default = `expanded`.
- [ ] `LegendSettings.placement` mendukung `inside-control` + floating variants + hidden.
- [ ] Migrasi project lama ditulis di `projectUpdates.ts`.

### C.2 Functional checks

1. **Default after fresh import**
   - [ ] Toggle layer panel **muncul** (kanan-atas atau sesuai posisi default).
   - [ ] Legend **tidak muncul** (kecuali user enable).

2. **Mode compact**
   - [ ] Set mode = compact → tombol ikon (Layers) di kanan-atas.
   - [ ] Klik → popover dengan checkbox per layer.
   - [ ] Klik di luar → popover tutup.

3. **Mode expanded**
   - [ ] Set mode = expanded → panel terbuka penuh dengan checkbox.
   - [ ] Aktifkan legend dengan placement = `inside-control` → legend muncul **di bawah** toggle dalam panel yang sama.
   - [ ] Toggle layer off → entry legend ikut hilang.

4. **Mode tree**
   - [ ] Set mode = tree → render hierarchical (group nama parent, children layer).
   - [ ] Klik group header → expand/collapse.

5. **Floating legend**
   - [ ] Legend placement = `floating-bottom-right` → legend keluar dari panel toggle, muncul di pojok kanan-bawah.
   - [ ] `floating-bottom-left`, `floating-top-right`, `floating-top-left` → posisi sesuai.
   - [ ] `hidden` → legend hilang sepenuhnya.

6. **Migrasi**
   - [ ] Buat project di branch sebelumnya dengan `legendShow: true`. Checkout branch Phase C. Reload → terbaca dengan `layerControlMode: "expanded"` + `legend.placement: "inside-control"`. Tidak crash.

### C.3 Regression checks

- [ ] ZIP runtime: setiap mode render identik dengan editor.
- [ ] Phase A widget Layer tree control bisa ditiadakan jika user pilih mode compact (tidak konflik).

### C.4 Acceptance gate

- [ ] Snapshot test untuk migrasi (`projectUpdates.ts`).
- [ ] Screenshot tiap mode di PR.

---

## Phase D — Editing toolkit setara Placemark

> Fase paling besar. Direkomendasikan dipecah jadi D1 (zoom-fix + hotkeys + snap), D2 (undo/redo + history), D3 (multi-select + transform + geometry ops + properties).

### D.1 Pre-flight

- [ ] Dependensi baru: `react-hotkeys-hook`, `@turf/buffer`, `@turf/simplify`, `@turf/convex`, `polygon-clipping`, `@placemarkio/turf-jsts`. TerraDraw upgrade ke versi yang punya SnappingMode.
- [ ] Folder `src/lib/geometryOps.ts` dan `src/state/history.ts` (atau setara) ada.

### D.2 Functional checks

1. **Bug zoom Sungai (D1)**
   - [ ] Pilih layer Sungai → klik fitur sungai → zoom in via mousewheel atau tombol +.
   - [ ] Map **tetap** zoomed in. Tidak ada jump kembali ke fitBounds layer.
   - [ ] Repeat 5×. Zoom stabil.
   - [ ] Aktifkan `?debug=1` → console log event flow (`zoomstart` / `zoomend` / `terradraw:select` tidak ada race).

2. **Hotkeys (D1)**
   - [ ] Tekan `1` → mode select. `2` → point. `3` → line. `4` → polygon. `5` → rectangle. `6` → circle. `7` → route (jika ada).
   - [ ] Shift+key → multi-draw mode (toolbar tunjuk indikator "+").
   - [ ] Tekan `?` → cheatsheet dialog terbuka. Tekan Esc → tutup.

3. **Snap mode (D1)**
   - [ ] Aktifkan snap → draw polygon → cursor tertarik ke vertex layer terdekat saat dekat (tolerance default).
   - [ ] Snap segment → cursor tertarik ke titik terdekat di segmen layer existing.

4. **Undo/redo (D2)**
   - [ ] Edit posisi vertex Batas Desa #12 → Cmd+Z → vertex kembali.
   - [ ] Cmd+Shift+Z → redo.
   - [ ] Menu File → History → list moment dengan label "Move vertex Batas Desa #12 (3 vertices)".
   - [ ] Klik moment lama → revert ke state itu.

5. **Geometry ops (D3)**
   - [ ] Pilih fitur Sungai → tab Edit → klik Buffer → input 50 (meter) → submit → layer baru "Sungai_buffer_50m" muncul di list, hasil polygon terlihat di map.
   - [ ] Convex hull pada multi-select polygon → hasil polygon tunggal.
   - [ ] Simplify slider (tolerance 0–10) → live preview update; submit → geometri tersimpan.
   - [ ] Polygon-to-line, merge, split, divide — masing-masing buat kasus tes minimal.

6. **Multi-select + transform (D3)**
   - [ ] Mode lasso → drag → 3 polygon terpilih (highlight).
   - [ ] Drag handle rotate → polygon ikut berputar.
   - [ ] Drag handle scale → polygon ikut skala.
   - [ ] Translate via drag → multi posisi bergerak.

7. **Properties panel (D3)**
   - [ ] Pilih fitur Batas Desa → properties panel kanan → list key/value.
   - [ ] Edit value NAMOBJ → save → attribute table ikut update.
   - [ ] Tambah key baru → tersimpan.
   - [ ] Hapus key → konfirmasi dialog.

8. **Persist edits**
   - [ ] Edit beberapa fitur → reload halaman → edit tetap ada (OPFS).
   - [ ] Export ZIP → buka GeoJSON layer di ekstraksi → koordinat ter-update.

### D.3 Regression checks

- [ ] Phase 0–C semua jalan.
- [ ] Edit fitur multi-geometri tetap diblokir dengan banner (TerraDraw belum support).

### D.4 Acceptance gate

- [ ] Test e2e: import → press `4` → click 3x → press Enter → polygon tersimpan → reload → polygon masih ada.
- [ ] Test history: edit 5 kali → undo 5 kali → state awal.
- [ ] Screenshot semua tools di toolbar dengan keycap badges terlihat.

---

## Phase E — Realistic Preview

### E.1 Pre-flight

- [ ] [src/lib/runtimePreview.ts](../src/lib/runtimePreview.ts) berisi logic blob URL bundling.
- [ ] PreviewOverlay support dua mode: "Editor preview" / "Runtime preview".

### E.2 Functional checks

1. **Runtime preview = mirror ZIP export**
   - [ ] Klik Preview → toggle "Runtime preview".
   - [ ] Iframe load. Welcome modal muncul (jika enabled) dengan teks user.
   - [ ] Measure, Photon search, layer tree control aktif (sama persis dengan ZIP).
   - [ ] Header/footer positioning identik dengan ZIP.
   - [ ] Auto-dismiss timer berjalan di iframe.

2. **Editor preview tetap cepat**
   - [ ] Toggle "Editor preview" → render via MapCanvas seperti sebelumnya. Cepat (< 200ms).

3. **Open in new tab**
   - [ ] Klik "Open in new tab" → buka iframe blob di tab baru → render full-screen tanpa toolbar overlay.

4. **Export Now dari preview**
   - [ ] Tombol "Export Now" → unduh ZIP. Identik dengan tombol Export di topbar.

5. **Diff editor vs runtime preview**
   - [ ] Buat side-by-side: editor preview di tab 1, runtime preview di tab 2. Pixel-similar (header, footer, layers, basemap, layer toggle, legend).

### E.3 Regression checks

- [ ] Phase 0–D jalan.
- [ ] Preview tidak memori-leak: buka tutup 10× → tidak ada warning "iframe tidak di-revoke".

### E.4 Acceptance gate

- [ ] Test e2e: import → klik Preview → toggle Runtime → assert iframe `srcdoc` berisi tag `<script src="q2ws-runtime.js">`.
- [ ] Screenshot PR: editor preview vs runtime preview vs ZIP open di tab baru.

---

## Cross-phase: hal yang HARUS dicek di setiap PR (apapun fasenya)

Selain checklist per fase, lakukan ini setiap PR review:

- [ ] **Build clean**: `npm run build` exit 0, **tidak** ada warning baru.
- [ ] **Smoke fixture pass**: `npm run smoke:fixture`.
- [ ] **Playwright map-render gate pass** (gate yang ditambahkan di Phase 0): import → `_loaded === true` → tile request fired → minimal 1 path/feature ter-render → console error count = 0.
- [ ] **StrictMode tetap ON**: grep `<React.StrictMode>` di [src/main.tsx](../src/main.tsx). Tidak boleh dihilangkan dengan alasan apapun.
- [ ] **MapCanvas.tsx ≤ 700 baris** (≤ 300 setelah Phase 1).
- [ ] **ZIP export juga jalan**: jangan pernah hanya tes editor.
- [ ] **Console bersih**: tidak ada error merah, warning baru harus dijelaskan di PR.
- [ ] **Screenshot PR**: minimal 1 editor + 1 ZIP runtime. Untuk fitur visual: screenshot setiap variant.
- [ ] **AGENTS.MD log entry**: append PR ke `/Users/dhanypedia/webgis-basic-with-qgis2web/AGENTS.MD` dengan ID fase, file, hasil tes, screenshot path.

---

## Quick triage flowchart kalau ada bug

```
Map kosong setelah import?
  └─> Buka DevTools Console
       ├─> Error Leaflet "Map container is being reused"
       │    → bug lifecycle map (cleanup tidak jalan). Investigasi useLeafletMap hook.
       ├─> Error "Cannot read properties of undefined (reading 'features')"
       │    → bug parser atau OPFS schema. Periksa migrasi.
       ├─> Tidak ada error, tile request 0
       │    → bug init: cek window.__q2ws_map._loaded di console. False → setView/fitBounds tidak terpanggil.
       │    → cek lastAutoFitKeyRef reset.
       └─> Tile request 4xx/5xx
            → CORS/network. Cek vite.config.ts COOP header. Cek URL basemap.

Popup berantakan?
  └─> Periksa layer.popupTemplate.mode
       ├─> "original" → cek HTML asli ter-sanitize benar (DOMPurify allowlist).
       ├─> "field-grid" → cek popupFields dedupe.
       └─> "custom" → cek Mustache replace.

Widget hilang dari ZIP?
  └─> Cek project.runtime.widgets[*].enabled.
       └─> Cek exportProject.ts copy asset.
```

---

**Dokumen ini hidup.** Update setiap kali Codex menemukan kasus tes baru yang berhasil/menggagalkan PR. Tujuannya: setiap fase berikutnya tidak mengulang regresi yang sudah pernah ditangani.
