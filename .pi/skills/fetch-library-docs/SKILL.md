---
name: fetch-library-docs
description: Fetch dokumentasi library mutakhir via Context7 sebelum tambah dependensi atau ubah pemanggilan API. Wajib dipakai sebelum tebak signature Leaflet, TerraDraw, Turf, atau library lain.
mcp: context7
trigger: Sebelum tulis kode yang menyentuh API library belum dikenal atau yang barusan di-upgrade
duration: ~2 menit
---

# Skill, fetch library docs

Tujuan: hindari kode yang nebak API. Fetch docs terbaru via Context7, baca, baru tulis kode.

## Kapan dipakai

- Sebelum import library baru ke `package.json`.
- Setelah upgrade dependency major version (Leaflet 1.x → 2.x, TerraDraw 0.x → 1.x).
- Saat butuh tahu signature method tertentu (e.g. `L.markerClusterGroup` opsi).
- Sebelum tulis kode integration baru (e.g. `react-hotkeys-hook`, `polygon-clipping`).

## Library yang sering dipakai

Berdasarkan AUDIT v3 dan rencana fase A-E:

| Library | Library ID di Context7 | Versi project |
|---|---|---|
| Leaflet | `/leaflet/leaflet` | 1.9.x |
| TerraDraw | `/jamesmilneruk/terra-draw` | 1.x (target Phase D) |
| terra-draw-leaflet-adapter | (search via `resolve-library-id`) | matched TerraDraw |
| Turf.js | `/turfjs/turf` | 7.x |
| react-resizable-panels | `/bvaughn/react-resizable-panels` | 2.x |
| react-hotkeys-hook | `/jorgegorka/react-hotkeys-hook` | 5.x (target Phase D) |
| polygon-clipping | `/mfogel/polygon-clipping` | 0.15.x (target Phase D) |
| dompurify | `/cure53/dompurify` | 3.x |
| leaflet.markercluster | `/leaflet/leaflet.markercluster` | 1.5.x |
| jszip | `/stuk/jszip` | 3.x |
| marked | `/markedjs/marked` | 12.x (target Phase B) |

ID di atas perkiraan, gunakan `resolve-library-id` untuk konfirmasi.

## Langkah

### 1. Resolve library ID

Via Context7 MCP tool `resolve-library-id`:

```
{
  "libraryName": "<nama package>"
}
```

Contoh untuk Leaflet:

```
{ "libraryName": "leaflet" }
```

Hasil: ID seperti `/leaflet/leaflet` plus daftar versi tersedia.

### 2. Fetch docs

Tool `get-library-docs`:

```
{
  "context7CompatibleLibraryID": "/leaflet/leaflet",
  "topic": "<topic spesifik atau kosong untuk overview>",
  "tokens": 5000
}
```

Pilih `topic` se-spesifik mungkin supaya hasil fokus:

- `"L.map options center zoom"` untuk init.
- `"L.tileLayer crossOrigin attribution"` untuk basemap.
- `"L.geoJSON pointToLayer onEachFeature"` untuk render.
- `"L.markerClusterGroup options"` untuk cluster.
- `"TerraDraw SnappingMode"` untuk snap.
- `"@turf/buffer units"` untuk geometry op.

### 3. Baca dan pin temuan

Catat di komentar kode atau di PR description:

```ts
// Leaflet 1.9.4: setView(center, zoom) wajib center sebagai LatLng-like + zoom number
// Source: Context7 /leaflet/leaflet, fetched YYYY-MM-DD
map.setView([lat, lng], 13);
```

### 4. Cross-reference dengan repo source jika perlu

Jika Context7 ambigu atau missing, fallback ke GitHub source:

- Leaflet: https://github.com/Leaflet/Leaflet
- TerraDraw: https://github.com/JamesLMilner/terra-draw
- Turf: https://github.com/Turfjs/turf

Pakai WebFetch atau git clone (one-shot, tidak persistent).

## Pattern wajib

1. Sebelum pakai opsi konstruktor library, fetch dulu daftar opsi yang valid. Jangan tebak.
2. Sebelum upgrade dependensi, fetch CHANGELOG via Context7 atau GitHub.
3. Setiap kali debugging error library yang tidak jelas, fetch error message + library docs.

## Anti pattern

1. Pakai Context7 untuk hal yang sudah ada di codebase. Kalau pattern sudah ada di project sendiri, pakai itu.
2. Fetch docs dengan `topic: ""` (overview) saat butuh detail spesifik. Buang token, hasil tidak fokus.
3. Mengabaikan version. Project Leaflet 1.9 berbeda dari 2.0 di banyak API. Selalu cek versi di `package.json` dulu.

## Output

- Snippet kode yang diadopsi disertai komentar source.
- Kalau temuan akan dipakai berulang, pin ke `docs/agents/library-notes.md` (file baru, bisa di-create on-demand).

## Catatan

- Context7 caches docs, hasil yang stale bisa muncul. Kalau mencurigai stale, fallback ke source repo.
- Untuk library yang sangat niche (custom plugin Leaflet), Context7 mungkin tidak punya. Gunakan WebFetch ke README repo.
