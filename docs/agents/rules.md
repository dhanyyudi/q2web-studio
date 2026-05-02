# Coding rules, qgis2web Studio

Sintesis dari AUDIT v3 §6. Semua aturan di bawah normatif. PR yang melanggar harus direject di review.

## 1. Map init wajib punya view

```ts
// SALAH
const map = L.map(container, { zoomControl: false });

// BENAR
const map = L.map(container, {
  zoomControl: false,
  center: [-2.5, 117.5],
  zoom: 4
});
```

Alasan: tanpa `center` + `zoom`, `_loaded` tetap `false`, tile dan layer tidak bisa render. Default fallback bebas (Indonesia centroid atau world view), yang penting view ada.

## 2. StrictMode safety di setiap useRef yang gating effect

React 18 StrictMode dijaga ON di [../../src/main.tsx](../../src/main.tsx). Setiap mount, semua effect double invoke (cleanup, body lagi). `useRef` mempertahankan nilai antar invocation.

Pattern wajib:

```ts
useEffect(() => {
  if (!containerRef.current || mapRef.current) return;

  // Reset semua ref yang membandingkan dengan map sebelumnya.
  lastAutoFitKeyRef.current = "";
  userMovedMapRef.current = false;
  programmaticMoveRef.current = false;
  tileErrorShownRef.current = false;

  const map = L.map(containerRef.current, { center, zoom, ... });
  mapRef.current = map;
  // ...
  return () => {
    map.remove();
    mapRef.current = null;
  };
}, []);
```

Atau pakai `mapInstanceVersion = useRef(0)` yang di-increment tiap mount, jadi ref lain bisa key off versi.

## 3. Satu concern per PR

Anti pattern: commit 1.649 baris yang mencampur Phase A widget parser, Phase B welcome modal, Phase C layer toggle refactor. Itu bikin regresi (map kosong) tidak terdeteksi.

Aturan praktis: kalau title PR butuh kata "and" atau koma, pecah PR-nya. Title harus satu kalimat, satu fase, satu komponen utama.

## 4. Test dua jalur tiap perubahan

Editor map dan runtime export adalah code path berbeda. [../../src/components/MapCanvas.tsx](../../src/components/MapCanvas.tsx) bikin `L.map()` sendiri. [../../src/runtime/runtime.ts](../../src/runtime/runtime.ts) overlay konfigurasi ke `window.map` yang dibuat oleh `index.html` qgis2web original.

Setiap perubahan yang menyentuh map, popup, layer, atau widget wajib ditest di:

1. Editor preview, jalankan `npm run dev`, import fixture, cek visual.
2. ZIP export, klik Export ZIP, ekstrak, serve via `python3 -m http.server`, cek.

Pakai skill [skills/verify-map-render.md](skills/verify-map-render.md) dan [skills/verify-runtime-export.md](skills/verify-runtime-export.md).

## 5. PR wajib screenshot dan smoke gate

PR description tidak akan di-approve tanpa:

- Screenshot editor preview hasil import fixture.
- Screenshot ZIP runtime hasil export.
- Output `npm run smoke:fixture` (PASS).
- Output Playwright map-render gate (PASS).

Detail di [skills/snapshot-pr-evidence.md](skills/snapshot-pr-evidence.md).

## 6. Parity sweep wajib sebelum open PR lintas editor/runtime/export

Jika perubahan menyentuh salah satu dari source of truth project, schema migration, hydration, editor preview, runtime preview, ZIP export, atau style yang harus sama antara editor dan runtime, lakukan parity sweep manual terstruktur sebelum buka PR.

Checklist minimal:

- Default baru konsisten di `defaults.ts`, hydration, migration, OPFS cache, editor preview, runtime, dan export config.
- Legacy value dimigrasikan eksplisit, terutama value lama yang masih dipertahankan demi backward compatibility.
- Custom setting terserialisasi ke `q2ws-config.json`, bukan hanya tersimpan di state editor.
- Editor preview dan runtime punya parity computed style untuk opsi visual utama, bukan hanya class name.
- Kombinasi posisi yang berpotensi tabrakan dicek di editor dan runtime, misalnya legend dan layer control sama-sama top-right.
- Smoke export punya assertion untuk field default dan custom yang baru ditambahkan.
- Playwright punya minimal satu assertion parity editor versus runtime untuk behavior baru.
- PR description menyebut hasil sweep, termasuk gap yang sengaja ditunda jika ada.

Jika 2 atau lebih item checklist tidak bisa dijawab cepat, pecah PR atau tambah test sebelum minta review.

## 7. Jangan matikan StrictMode

Bug yang hanya muncul di StrictMode adalah bug production yang nanti muncul saat tab reload, navigasi balik, atau React 19 concurrent rendering. Matikan StrictMode = sembunyikan bug.

## 7. EYD, no dash

Tidak pakai dash (`-`, `—`, `–`) untuk jeda kalimat dalam markdown atau komentar kode. Pakai koma atau split kalimat. Dash hanya untuk: kata ulang ("sama-sama"), bullet list, atau syntax kode.

Aturan ini berlaku global di project, lihat root [../../../AGENTS.MD](../../../AGENTS.MD).

## 8. Touch points panas (high blast radius)

File-file ini wajib pakai approach defensive. Sentuh dengan mindfullness.

| File | Concern utama | Test pertama yang harus jalan |
|---|---|---|
| [../../src/components/MapCanvas.tsx](../../src/components/MapCanvas.tsx) | Map init, basemap, render layer, autofit, TerraDraw | [skills/verify-map-render.md](skills/verify-map-render.md) |
| [../../src/runtime/runtime.ts](../../src/runtime/runtime.ts) | Runtime overlay ke index.html original | [skills/verify-runtime-export.md](skills/verify-runtime-export.md) |
| [../../src/lib/qgis2webParser.ts](../../src/lib/qgis2webParser.ts) | Parse widget, basemap, label, popup HTML | smoke:fixture + verify-map-render |
| [../../src/lib/exportProject.ts](../../src/lib/exportProject.ts) | Bundle asset ke ZIP | verify-runtime-export |
| [../../src/lib/opfs.ts](../../src/lib/opfs.ts) | Persist project, schema migration | reload halaman setelah import |
| [../../src/types/project.ts](../../src/types/project.ts) | Source of truth type, breaking change radius luas | TypeScript strict + cek migrasi |

## 9. Cap ukuran komponen

`MapCanvas.tsx` tidak boleh > 700 baris. Setelah Phase 1 split, target ≤ 300 baris. Hard cap di review.

## 10. Instrumentasi gated, bukan permanen

Saat debug, tambah `console.debug` atau `window.__q2ws_*` global. Tutup di balik query flag `?debug=1`. Sebelum merge, hapus atau pindahkan ke `src/lib/debug.ts` yang feature-flagged.

## 11. Jangan invent API

Saat butuh tahu API Leaflet, TerraDraw, Turf, jalankan skill [skills/fetch-library-docs.md](skills/fetch-library-docs.md) untuk fetch docs terbaru via Context7. Jangan tebak parameter atau method.

## 12. Runtime piggybacks original index.html

Runtime di-design overlay di atas `index.html` qgis2web original. Variable global `window.map`, `window.layer_BatasDesa_3` dll. dibutuhkan. Jangan regenerate `index.html` dari studio kecuali user eksplisit minta. Jika ada feature yang butuh regenerate, eskalasi ke user dulu.

Detail kontrak di komentar header [../../src/runtime/runtime.ts](../../src/runtime/runtime.ts) (tambahkan kalau belum ada).
