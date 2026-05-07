# Phase 8 implementation done

## Summary
Task 1 selesai, fokus pada discriminator type raster dan guard back compat tanpa mengubah runtime render.

Saya menambahkan model type raster dasar, helper guard, normalisasi hydration untuk project lama, serta guard update helper agar layer non vector tidak ikut masuk ke path edit atribut vector. Parser vector existing juga ditandai eksplisit dengan `kind: "vector"` saat import baru.

Task 2 belum diimplementasikan ke codebase, sesuai scope hanya menyiapkan strategi fixture. Strateginya, tambah tiga fixture ZIP terpisah untuk `raster-image`, `raster-wms`, dan `raster-pmtiles`, lalu perluas `scripts/smoke-fixture.ts` dengan helper loader ZIP generik dan assertion parser per keluarga raster. Assertion itu sengaja baru diaktifkan saat parser raster mulai dikerjakan supaya commit Task 1 tetap hijau.

## Files
- `src/types/project.ts`: tambah type raster dasar, union `ProjectLayer`, dan jadikan `LayerManifest.kind` optional untuk back compat.
- `src/lib/rasterParsing.ts`: tambah type guard raster dan helper normalisasi `kind` lama ke `vector`.
- `src/lib/projectHydration.ts`: normalisasi layer lama via guard, proses feature ID hanya untuk vector, dan `projectCenter` hanya hitung layer vector.
- `src/lib/projectUpdates.ts`: migrasi layer lama aman, guard vector-only untuk operasi atribut dan field update.
- `src/lib/qgis2webParser.ts`: layer hasil parse baru sekarang ditulis dengan `kind: "vector"`.
- `scripts/smoke-fixture.ts`: tambah smoke guard untuk discriminator raster declaration dan baseline assert bahwa fixture lama tetap vector-only.

## New deps
- Tidak ada

## Test results
- `npm run build`: PASS
- `npm run smoke:fixture`: PASS

## Risk / follow-up
- Type union `ProjectLayer` sudah ditambahkan, tetapi `Qgis2webProject.layers` sengaja masih tetap bertipe `LayerManifest[]` supaya perubahan Task 1 tidak memaksa refactor besar di UI dan runtime sebelum Task 3 ke atas.
- Task 2 fixture strategy siap, tetapi fixture ZIP raster belum ditambahkan ke repo pada commit ini.
- Parser, editor preview, runtime preview, dan ZIP export raster belum disentuh, sesuai scope.

## Next
- Lanjut ke Task 2 fixture onboarding saat scope berikutnya dibuka.
- Handoff ke qa-runner phase=8 setelah parser raster mulai masuk, bukan pada Task 1 ini.
