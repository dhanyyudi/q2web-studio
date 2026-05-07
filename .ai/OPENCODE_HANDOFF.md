# OpenCode to Pi Handoff

## Current branch
- Branch: `main`
- PR / issue URL: `https://github.com/dhanyyudi/q2web-studio/pull/37`
- Base branch: `main`

## Goal terakhir
- Menutup sisa Audit V4 Phase 2a pada mechanical split `App.tsx`, khususnya memindahkan project inspector dan alur import export ke area yang lebih terpisah tanpa mengubah perilaku editor, preview, OPFS persistence, atau runtime export.
- Menyelesaikan follow-up review Codex pada PR #37, yaitu menghapus breadcrumb layer yang duplikat di inspector.
- Sesudah merge, menyinkronkan repo app ke `main` dan menambah log merge di root training repo changelog.

## Status sekarang
- Yang sudah selesai:
  - PR #37 sudah merged ke `main`.
  - Repo app `qgis2web-studio` sudah di-sync ke merge commit `1b8f3596f7d2a07dd3ae78db4a9f30463130f852`.
  - Worktree Phase 2a completion sudah dihapus.
  - Branch lokal `audit-v4-phase2a-completion` sudah dihapus.
  - Root changelog sudah ditambah untuk PR #37 open dan merge.
- Yang belum selesai:
  - Belum ada pekerjaan fase berikutnya yang dimulai.
  - Belum ada penilaian final apakah Audit V4 Phase 2a sekarang dianggap fully closed terhadap wording audit yang paling ketat.
- Yang sedang menunggu:
  - Tidak ada PR/check aktif untuk PR #37 karena PR sudah merged.
  - Jika lanjut kerja, agent berikutnya perlu menentukan target fase selanjutnya atau audit reconciliation berikutnya.

## Perubahan penting
- File penting yang sudah diubah:
  - `src/App.tsx`
  - `src/components/Inspector/BrandingTab.tsx`
  - `src/components/Inspector/ProjectMapTab.tsx`
  - `src/components/Inspector/InspectorShell.tsx`
  - `src/components/Inspector/controls.tsx`
  - `src/components/ProjectInspector.tsx`
  - `src/hooks/useImportExport.ts`
  - `tests/map-render.spec.ts`
  - `docs/agents/changelog/2026-05.md` di root training repo, bukan repo app
- Ringkasan alasan perubahan tiap area:
  - `src/App.tsx`: mengurangi orchestration yang terlalu besar dengan memindahkan flow import, save local, close project, dan export ZIP ke hook terpisah.
  - `src/components/ProjectInspector.tsx`: dijadikan shell tipis agar konfigurasi project tidak lagi menumpuk di satu file besar.
  - `src/components/Inspector/BrandingTab.tsx`: memisahkan setting branding, welcome, sidebar, dan theme dari shell inspector.
  - `src/components/Inspector/ProjectMapTab.tsx`: memisahkan setting basemap, map view, widgets, legend, dan popup project-level dari shell inspector.
  - `src/components/Inspector/InspectorShell.tsx`: mempertahankan wiring Phase 2b dan follow-up review Codex menghapus duplicate breadcrumb layer.
  - `src/components/Inspector/controls.tsx`: menambah shared controls yang dipakai tab hasil split, termasuk `TextAreaInput`, `SegmentedControl`, dan `SwitchLabel` yang mendukung `testId`.
  - `src/hooks/useImportExport.ts`: rumah baru untuk import folder, import ZIP, drag and drop import, save local, close project, dan export ZIP, dengan behavior toast, status, dan OPFS yang tetap sama.
  - `tests/map-render.spec.ts`: regression tetap dijaga untuk Phase 2b inspector ordering, dan di-update agar memastikan breadcrumb layer hanya tampil sekali.
  - `docs/agents/changelog/2026-05.md`: mencatat pembukaan PR #37 dan merge sync setelah PR merged.

## Commands/tests yang sudah dijalankan
- Command: `npm run build`
- Hasil: berhasil setelah extraction dan juga berhasil lagi setelah fix review Codex.
- Yang masih gagal jika ada: tidak ada pada run terakhir.

- Command: `npm run smoke:fixture`
- Hasil: berhasil.
- Yang masih gagal jika ada: tidak ada pada run terakhir.

- Command: `npm run smoke:export`
- Hasil: berhasil.
- Yang masih gagal jika ada: tidak ada pada run terakhir.

- Command: `npm run smoke:map`
- Hasil: berhasil dengan `30 passed` pada Phase 2a completion branch sebelum PR merge.
- Yang masih gagal jika ada: tidak ada pada run terakhir.

- Command: `npx playwright test tests/map-render.spec.ts -g "phase 2b layer inspector uses ordered sections"`
- Hasil: sempat gagal setelah duplicate breadcrumb dihapus karena test masih mengharapkan breadcrumb kedua, lalu test diperbarui dan rerun berhasil dengan `1 passed`.
- Yang masih gagal jika ada: tidak ada pada run terakhir.

- Command: `git pull --ff-only`
- Hasil: repo app `qgis2web-studio` berhasil fast-forward ke merge commit PR #37.
- Yang masih gagal jika ada: tidak ada.

## Known risks
- Risiko regression:
  - Flow import/export sekarang tersebar antara `App.tsx` dan `useImportExport.ts`, jadi perubahan berikutnya harus menjaga parity status message, toast, OPFS persistence, dan input reset.
  - Inspector sekarang lebih terpecah, jadi mudah merusak wiring antar tab jika ada refactor yang terlalu agresif di `InspectorShell` atau props `ProjectInspector`.
  - Regression test inspector ordering sekarang juga memastikan hanya ada satu breadcrumb scope. Jika struktur markup inspector diubah lagi, test ini kemungkinan perlu disesuaikan dengan hati-hati.
- Area yang harus hati-hati:
  - Jangan regress fix Phase 2b geometry ops disabled state saat belum ada selected feature.
  - Jangan regress left panel width restore behavior dari PR #34.
  - Jangan mulai fase fitur baru tanpa memastikan scope Audit V4 sebelumnya memang sudah ditutup sesuai keputusan user.
  - App repo masih punya untracked lokal yang memang tidak boleh ikut commit sembarangan: `POST-PR10-IMPLEMENTATION-PLAN.md` dan `opencode.json`.
  - Root training repo masih punya perubahan lokal tidak terkait di `.gitignore`, jadi commit changelog berikutnya harus tetap selective.

## Pending TODO untuk agent berikutnya
1. Reconcile status Audit V4 setelah merge PR #37 dan tentukan apakah Phase 2a sekarang benar-benar closed terhadap exact audit wording.
2. Jika user ingin lanjut implementasi, tentukan fase berikutnya yang akan dikerjakan dan mulai dari branch atau worktree baru dari `main` yang sudah sinkron di `1b8f359` atau lebih baru.
3. Saat membuat changelog root berikutnya, tetap commit selective karena root repo masih punya perubahan `.gitignore` yang tidak terkait.

## Exact next instruction for Pi
Baca `AGENTS.md`, `docs/AUDIT-2026-04-29-v3.md`, dan `docs/AUDIT-2026-05-01-v4.md` di repo `qgis2web-studio`, lalu verifikasi status pasca merge PR #37 dari branch `main` saat ini. Fokus pertama: tentukan secara eksplisit apakah Audit V4 Phase 2a sekarang sudah fully closed atau masih ada gap nyata terhadap wording audit. Jangan ubah source code aplikasi dulu sebelum menyampaikan assessment berbasis file current state dan git history terbaru. Perhatikan bahwa repo app masih punya untracked `POST-PR10-IMPLEMENTATION-PLAN.md` dan `opencode.json` yang tidak boleh ikut commit, dan root training repo masih punya perubahan `.gitignore` yang tidak terkait.
