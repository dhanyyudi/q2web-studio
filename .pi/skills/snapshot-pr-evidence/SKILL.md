---
name: snapshot-pr-evidence
description: Kumpulkan semua bukti yang wajib dilampirkan di PR description. Build clean, smoke pass, screenshot editor + ZIP, console log, network log. Wajib dijalankan sebelum buka PR.
mcp: playwright + chrome-devtools (sequential)
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

### 3. Screenshot editor preview

Pakai Playwright MCP:

1. Start dev server `npm run dev` di background.
2. `browser_navigate` ke http://127.0.0.1:5173.
3. Import fixture (zip atau folder).
4. Wait toast "Imported 4 layers".
5. `browser_take_screenshot` full page → simpan `editor-$TS.png`.

### 4. Screenshot runtime export

Sequence dari skill [verify-runtime-export.md](verify-runtime-export.md):

1. Klik Export ZIP, tunggu unduh.
2. Ekstrak ke `/tmp/q2ws-export-$TS`.
3. Serve via `python3 -m http.server 8765`.
4. `browser_navigate` ke http://127.0.0.1:8765/index.html.
5. Wait map ready.
6. `browser_take_screenshot` → simpan `runtime-$TS.png`.

### 5. Console + network dump

Setelah step 3 dan 4 selesai, sebelum tutup browser:

```js
// console
() => {
  const messages = []; // collected via browser_console_messages
  // ...
}
```

Pakai `browser_console_messages` MCP tool, dump ke `console-$TS.txt`.

`browser_network_requests` filter URL match basemap, dump ke `network-tile-$TS.json`.

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

Template:

```markdown
## Phase <id> – <title>

### Summary
<1-3 kalimat>

### Changes
- <file 1>: <ringkasan perubahan>
- <file 2>: ...

### Evidence
- Build: see `docs/screenshots/phase-<id>/build-<ts>.txt` (PASS)
- Smoke: see `docs/screenshots/phase-<id>/smoke-<ts>.txt` (PASS)
- Playwright e2e: see `docs/screenshots/phase-<id>/playwright-<ts>.txt` (PASS)
- Editor render: ![editor](../../docs/screenshots/phase-<id>/editor-<ts>.png)
- Runtime render: ![runtime](../../docs/screenshots/phase-<id>/runtime-<ts>.png)
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
