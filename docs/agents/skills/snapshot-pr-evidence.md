---
name: snapshot-pr-evidence
description: Kumpulkan semua bukti yang wajib dilampirkan di PR description. Build clean, smoke pass, screenshot editor + ZIP, console log, network log. Wajib dijalankan sebelum buka PR.
mcp: pinchtab + playwright + chrome-devtools (sequential)
trigger: Sebelum buka PR untuk fase apapun
duration: ~10 menit
---

# Skill, snapshot PR evidence

Tujuan: lengkapi PR description dengan semua bukti yang dibutuhkan reviewer untuk approve. Tanpa bukti = reject.

## Output yang dihasilkan

Semua disimpan di `docs/screenshots/phase-<id>/` dengan timestamp:

1. `build-<YYYYMMDD-HHmm>.txt` — output `npm run build`.
2. `smoke-<YYYYMMDD-HHmm>.txt` — output `npm run smoke:fixture`.
3. `playwright-<YYYYMMDD-HHmm>.txt` — output map-render gate.
4. `editor-<YYYYMMDD-HHmm>.png` — screenshot editor setelah import.
5. `runtime-<YYYYMMDD-HHmm>.png` — screenshot ZIP runtime.
6. `console-<YYYYMMDD-HHmm>.txt` — console log dump.
7. `network-tile-<YYYYMMDD-HHmm>.json` — tile request log.
8. (Phase D) `events-<YYYYMMDD-HHmm>.json` — event log untuk regresi yang sensitif terhadap order.

## Policy singkat

- PinchTab adalah default tool lokal untuk screenshot evidence dan validasi visual manual.
- Playwright tetap gate resmi untuk pass atau fail, smoke test, dan CI.
- Chrome DevTools dipakai hanya jika butuh forensic runtime yang tidak cukup dari PinchTab atau Playwright.
- Jika PinchTab `upload` aktif, gunakan itu untuk import ZIP manual. Jika tidak aktif, fallback ke Playwright.
- Untuk PR yang mengubah parity editor, runtime, export, hydration, migration, atau schema project, lakukan parity sweep manual terstruktur sebelum PR dibuka.

## Parity sweep wajib, sebelum compose PR description

Pakai checklist ini untuk perubahan lintas editor, runtime, export, atau state migration:

1. **Default parity**
   - cek default baru di `src/lib/defaults.ts`
   - cek hydration migration fallback
   - cek project update migration fallback
   - cek OPFS hydration atau autosave path jika relevan
   - cek runtime fallback dan editor preview memakai default yang sama

2. **Legacy compatibility parity**
   - cek value lama yang masih mungkin muncul, misalnya rename enum atau mode lama
   - pastikan migrasi eksplisit, bukan kebetulan lolos karena `||` fallback

3. **Serialization parity**
   - cek field baru ikut ke `q2ws-config.json`
   - cek field custom survive export, bukan hanya terlihat di state editor
   - tambah assertion di smoke export untuk default dan custom value

4. **Visual parity editor versus runtime**
   - cek computed style, bukan hanya class name
   - minimal satu assertion Playwright harus membandingkan editor dengan runtime untuk behavior baru
   - untuk control visual, cek warna, ukuran teks, posisi, radius, opacity, atau offset yang relevan

5. **Collision parity**
   - cek kombinasi posisi yang rawan overlap, misalnya legend dan layer control di sudut yang sama
   - cek editor dan runtime sama-sama menghindari tabrakan

6. **Evidence parity**
   - screenshot editor wajib menunjukkan state baru
   - screenshot runtime wajib menunjukkan state yang sama
   - jika ada deviasi yang sengaja ditunda, tulis eksplisit di PR notes

Jika checklist ini menghasilkan 2 atau lebih gap, jangan buka PR dulu. Tambah test, pecah scope, atau selesaikan gap lebih dulu.

## Langkah

### 1. Build dan smoke

```bash
cd qgis2web-studio
mkdir -p docs/screenshots/phase-$PHASE_ID
TS=$(date +%Y%m%d-%H%M)
DEST=docs/screenshots/phase-$PHASE_ID

npm run build 2>&1 | tee $DEST/build-$TS.txt
npm run smoke:fixture 2>&1 | tee $DEST/smoke-$TS.txt
```

Cek tail dari kedua file. Kalau ada error, stop di sini, fix dulu.

### 2. Run Playwright e2e gate

Skill ini assumes gate sudah ditambahkan di `tests/e2e/map-render.spec.ts` atau setara.

```bash
npx playwright test tests/e2e/map-render.spec.ts 2>&1 | tee $DEST/playwright-$TS.txt
```

Kalau belum ada, jalankan langkah dari skill [verify-map-render.md](verify-map-render.md) manual via MCP.

### 3. Screenshot editor preview, default pakai PinchTab

Urutan default:

1. Start dev server `npm run dev` di background.
2. Buka editor via PinchTab.
3. Import fixture ZIP.
   - Jika `security.allowUpload=true`, pakai `pinchtab upload` ke input ZIP.
   - Jika upload belum aktif, fallback ke Playwright file upload.
4. Wait status `Imported 4 layers`.
5. Ambil screenshot penuh editor via PinchTab, simpan `editor-$TS.png`.
6. Simpan snapshot accessibility jika perlu untuk bukti urutan section atau sticky toolbar.

Fallback yang tetap valid:
- Jika PinchTab tidak tersedia, gunakan Playwright MCP `browser_take_screenshot`.

### 4. Screenshot runtime export

Sequence dari skill [verify-runtime-export.md](verify-runtime-export.md):

1. Klik Export ZIP, tunggu unduh.
2. Ekstrak ke `/tmp/q2ws-export-$TS`.
3. Serve via `python3 -m http.server 8765`.
4. Buka runtime via PinchTab atau Playwright.
5. Wait map ready.
6. Ambil screenshot `runtime-$TS.png`.

Preferensi sekarang:
- gunakan PinchTab untuk screenshot runtime jika tujuannya bukti visual PR
- gunakan Playwright jika screenshot bagian dari test step atau fallback otomatis

### 5. Console + network dump

Setelah step 3 dan 4 selesai, sebelum tutup browser:

- Untuk workflow visual lokal, boleh ambil console dan network via PinchTab.
- Untuk workflow test gate, boleh ambil via Playwright MCP.
- Jika butuh detail request granular atau forensic runtime, lanjut ke Chrome DevTools.

Simpan:
- `console-$TS.txt`
- `network-tile-$TS.json` atau `.txt`

Minimal yang harus terbukti:
- tidak ada console error baru
- tile atau basemap request sukses

### 6. Phase-specific extra evidence

| Phase | Extra screenshot |
|---|---|
| 0 (Hotfix) | Sebelum-sesudah: editor blank vs editor render |
| 1 (Refactor) | Tidak ada UI baru, tapi tambah 1 screenshot zoom in/out untuk regression |
| A (Faithfulness) | Editor + runtime, dengan widget terlihat (ruler, search) plus label NAMOBJ |
| B (Inspector UX) | 4 variant header placement + 3 variant footer + welcome modal + sidebar |
| C (Toggle vs Legend) | 3 mode (compact/expanded/tree) + 5 placement legend |
| D (Editing) | Hotkey toolbar dengan keycap, history list, geometry ops result, multi-select transform |
| E (Realistic Preview) | Editor preview vs Runtime preview side-by-side |

### 7. Compose PR description

Sebelum tulis PR description final, tambahkan satu bullet ringkas hasil parity sweep untuk PR yang mengubah editor, runtime, export, hydration, migration, atau schema. Format ringkas yang disarankan:

```markdown
### Parity sweep
- Default parity: PASS
- Legacy migration parity: PASS
- Export serialization parity: PASS
- Editor versus runtime visual parity: PASS
- Collision parity: PASS
- Deferred gaps: none
```


Template:

```markdown
## Phase <id> – <title>

### Summary
<1-3 kalimat>

### Changes
- <file 1>: <ringkasan perubahan>
- <file 2>: ...

### Parity sweep
- Default parity: PASS
- Legacy migration parity: PASS
- Export serialization parity: PASS
- Editor versus runtime visual parity: PASS
- Collision parity: PASS
- Deferred gaps: none

### Evidence
- Build: see `docs/screenshots/phase-<id>/build-<ts>.txt` (PASS)
- Smoke: see `docs/screenshots/phase-<id>/smoke-<ts>.txt` (PASS)
- Playwright e2e: see `docs/screenshots/phase-<id>/playwright-<ts>.txt` (PASS)
- Editor render: ![editor](../../docs/screenshots/phase-<id>/editor-<ts>.png)
- Runtime render: ![runtime](../../docs/screenshots/phase-<id>/runtime-<ts>.png)
- Screenshot tool: PinchTab by default for local visual evidence, Playwright if taken inside test flow
- Console: clean (lihat `docs/screenshots/phase-<id>/console-<ts>.txt`)
- Network tile: 4 request 200 OK (lihat `docs/screenshots/phase-<id>/network-tile-<ts>.json`)

### QA checklist
- [x] Phase <id> functional checks (lihat `docs/QA-CHECKLIST-PER-PHASE.md` §<phase>)
- [x] Regression checks fase sebelumnya
- [x] AGENTS.MD log entry appended

### Notes
<deviasi dari plan, tradeoff, follow-up>
```

### 8. Update root AGENTS.MD log

```bash
cat >> ../AGENTS.MD <<EOF

### $(date +"%Y-%m-%d %H:%M") WIB

- Ringkasan: Phase <id> <title> merged
- File: <list>
- Catatan: bukti di docs/screenshots/phase-<id>/*-$TS.*
EOF
```

Pastikan format konsisten dengan entries existing.

## Output checklist

- [ ] Folder `docs/screenshots/phase-<id>/` ada minimal 7 file
- [ ] PR description punya semua link bukti
- [ ] Jika PR lintas editor/runtime/export, bagian `Parity sweep` sudah terisi
- [ ] Build, smoke, e2e PASS
- [ ] Console error count = 0
- [ ] Tile request status 200 (atau dijelaskan kenapa)
- [ ] Root AGENTS.MD ter-append

## Anti pattern

1. Buka PR sebelum bukti lengkap. Reviewer punya hak reject.
2. Pakai screenshot lama dari fase sebelumnya. Setiap fase butuh fresh evidence.
3. Edit screenshot dengan tool external. Raw screenshot only, tanpa annotation kecuali eksplisit dibutuhkan untuk highlight bug.
4. Lupa kill dev server dan static server di akhir. Cleanup wajib.

## Catatan

- Untuk PR yang besar (Phase A, D), pertimbangkan pecah evidence per sub-PR.
- Screenshot disimpan di repo karena ringan dan trace-able. Kalau ukuran > 1 MB per file, kompres pakai `pngquant` atau `optipng`.
- Workflow yang berlaku sekarang: PinchTab untuk screenshot dan validasi visual manual, Playwright untuk gate resmi dan CI.
- Kalau `security.allowUpload=true`, PinchTab boleh dipakai untuk import ZIP lokal saat menyiapkan screenshot evidence.
