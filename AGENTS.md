# q2web Studio, project-level AGENTS

> Routing file. Auto loaded oleh Codex CLI, Claude Code, dan OpenCode dari project root.
> Dokumen panjang ada di [docs/agents/](docs/agents/). Aturan koding wajib dibaca di [docs/agents/rules.md](docs/agents/rules.md).
> Untuk rule global proyek (training Quarto, EYD, dash-policy), lihat [../AGENTS.MD](../AGENTS.MD).

## Konteks ringkas

`q2web-studio` adalah Vite + React 18 + Leaflet + TerraDraw single page editor untuk hasil export qgis2web. Tujuan: import folder/ZIP qgis2web, edit branding, layer style, popup, label, lalu emit ZIP statis dengan runtime kustom. Pakai OPFS untuk autosave lokal.

Audit sumber kebenaran:

1. [docs/AUDIT-2026-04-29-v3.md](docs/AUDIT-2026-04-29-v3.md), supersede v1 dan v2 di topik yang tumpang tindih. Kritis: §3 root cause map kosong, §6 rules anti-regresi.
2. [docs/QA-CHECKLIST-PER-PHASE.md](docs/QA-CHECKLIST-PER-PHASE.md), checklist QA manual per fase.
3. [docs/AUDIT-2026-04-29-v2.md](docs/AUDIT-2026-04-29-v2.md), 11 keluhan user dan rencana fase A-E.
4. [docs/AUDIT-2026-04-29.md](docs/AUDIT-2026-04-29.md), audit awal Sprint 1.

## Status saat ini

Fase 0 (Hotfix map kosong) belum di-merge. Tidak boleh memulai fase fitur lain sebelum Fase 0 selesai dan map terbukti render. Lihat [docs/AUDIT-2026-04-29-v3.md §7](docs/AUDIT-2026-04-29-v3.md#7-recovery-plan-revised).

## MCP yang aktif di workspace

| MCP | Fungsi utama | Pakai untuk |
|---|---|---|
| `playwright` | Browser automation, network capture, screenshot | Verifikasi map render, ZIP export jalan, e2e gate per fase |
| `chrome-devtools` | Inspect runtime DOM, evaluate, listen events, network | Debug Leaflet state, cek `_loaded`, trace event yang trigger zoom anomali |
| `context7` | Fetch docs library terbaru | Sebelum tambah dependensi atau ubah API call (Leaflet, TerraDraw, Turf, dll) |
| `pinchtab` | Browser service lokal dengan profile persistent, snapshot accessibility, dan HTTP/MCP bridge | Eksplorasi UI interaktif, debug manual, persistent browser state, bukan pengganti Playwright gate |

Detail routing per skenario di [docs/agents/mcp-routing.md](docs/agents/mcp-routing.md).

## Skills yang tersedia

Skill di repo ini terbagi dua lapis. Domain skills (markdown statis di `docs/agents/skills/`) dipakai semua runtime termasuk Codex CLI. Process skills (lewat plugin superpowers) hanya aktif di OpenCode.

### Layer 1, Domain skills (Leaflet, runtime, qgis2web)

Lihat [docs/agents/skills/](docs/agents/skills/). Tiap skill adalah markdown self-contained dengan langkah eksekusi siap pakai.

| Skill | File | Trigger |
|---|---|---|
| Verifikasi map render | [skills/verify-map-render.md](docs/agents/skills/verify-map-render.md) | Setelah perubahan apapun di MapCanvas atau qgis2webParser |
| Verifikasi ZIP export | [skills/verify-runtime-export.md](docs/agents/skills/verify-runtime-export.md) | Setelah perubahan runtime.ts atau exportProject.ts |
| Inspect Leaflet state | [skills/inspect-leaflet-state.md](docs/agents/skills/inspect-leaflet-state.md) | Saat debugging map kosong, zoom anomali, atau tile error |
| Fetch library docs | [skills/fetch-library-docs.md](docs/agents/skills/fetch-library-docs.md) | Sebelum tambah dependensi atau ubah API call |
| Snapshot PR evidence | [skills/snapshot-pr-evidence.md](docs/agents/skills/snapshot-pr-evidence.md) | Sebelum buka PR, kumpulkan screenshot dan log |

### Layer 2, Process skills (superpowers, hanya OpenCode)

Plugin [`obra/superpowers`](https://github.com/obra/superpowers) terdaftar di [opencode.json](opencode.json). Aktif otomatis di setiap session OpenCode lewat tool native `skill`. Tidak dipakai Codex CLI dan Claude Code (pakai layer 1 saja).

| Skill (panggil `skill <nama>`) | Trigger |
|---|---|
| `brainstorming` | Sebelum kerja kreatif (fitur baru, komponen baru, ubah behavior) |
| `writing-plans` | Saat punya spec multi-step, sebelum sentuh kode. Output ke `docs/superpowers/plans/` |
| `executing-plans` / `subagent-driven-development` | Eksekusi plan (yang kedua kalau dispatch ke subagent project) |
| `systematic-debugging` | Sebelum propose fix bug apapun. Iron law: NO FIX WITHOUT ROOT CAUSE |
| `test-driven-development` | Implementasi fitur atau bugfix |
| `verification-before-completion` | Sebelum klaim selesai atau buka PR. Iron law: evidence before claims |
| `requesting-code-review` / `receiving-code-review` | Sekitar PR, sebelum dan sesudah review |
| `finishing-a-development-branch` | Sebelum merge / cleanup branch |
| `using-git-worktrees` | Saat butuh branch parallel tanpa polusi tree utama |
| `dispatching-parallel-agents` | Saat investigasi multi-area paralel |

Aturan koding di [docs/agents/rules.md](docs/agents/rules.md) tetap menang di atas semua skill. Skill `using-superpowers` eksplisit set prioritas: user instructions (AGENTS.md, rules.md) > superpowers > default.

### Pola delegasi gabungan

```
Bug map kosong
  → skill systematic-debugging
  → @map-doctor
  → skill verification-before-completion
  → @qa-runner phase=0

Phase B implementasi
  → skill brainstorming
  → skill writing-plans (output: docs/superpowers/plans/...)
  → skill subagent-driven-development
       → @phase-implementer per task
       → @pr-reviewer per chunk
  → @qa-runner phase=B
  → skill requesting-code-review

Riset dependensi
  → @lib-researcher (process skill tidak perlu, langsung domain)
```

Catatan: subagent project (qa-runner, map-doctor, dst.) tidak auto-load superpowers karena `using-superpowers` punya blok `<SUBAGENT-STOP>`. Mereka tetap fokus pada system prompt masing-masing. Yang invoke superpowers = primary atau Anda sendiri.

## Aturan koding (ringkasan, detail di rules.md)

1. Jangan panggil `L.map()` tanpa `center` dan `zoom`.
2. Reset semua `useRef` yang gating effect di awal init effect, jangan andalkan nilai awal (StrictMode safety).
3. Satu concern per PR. Hindari bundle 1500 baris seperti commit Phase A+B sebelumnya.
4. Test dua jalur tiap perubahan: editor preview DAN ZIP export via `python3 -m http.server`.
5. PR wajib screenshot map render fixture, plus run skill `verify-map-render` di CI.
6. Sebelum open PR yang menyentuh editor/runtime/export/hydration/migration/schema, lakukan parity sweep manual terstruktur dan tulis hasilnya di PR description.
7. Setiap kali reply di PR, selalu tag `@codex` supaya feedback berikutnya tetap terpicu dan Codex bisa melihat reply context agent.
8. `<React.StrictMode>` di [src/main.tsx](src/main.tsx) tidak boleh dimatikan. Bug yang muncul karena StrictMode adalah bug yang harus diperbaiki, bukan dihindari.
9. EYD: tidak pakai dash (`-`, `—`, `–`) untuk jeda kalimat. Pakai koma atau split kalimat.

Detail dan justifikasi tiap aturan ada di [docs/agents/rules.md](docs/agents/rules.md).

## Setup MCP di OpenCode (referensi)

```bash
opencode mcp list
# ●  ✓ playwright connected
# ●  ✓ chrome-devtools connected
# ●  ✓ context7 connected
```

Setup masing-masing:

- Playwright MCP, https://github.com/microsoft/playwright-mcp, perintah `npx -y @playwright/mcp@latest --browser=chromium`.
- Chrome DevTools MCP, https://github.com/ChromeDevTools/chrome-devtools-mcp, perintah `npx -y chrome-devtools-mcp@latest`.
- Context7, https://github.com/upstash/context7, endpoint `https://mcp.context7.com/mcp`.
- PinchTab, https://github.com/pinchtab/pinchtab, perintah `pinchtab mcp`. Service lokal dipasang lewat `pinchtab daemon install`.

## Browser harness policy

Playwright tetap menjadi gate resmi untuk CI, smoke test, assertion deterministik, `verify-map-render`, dan `verify-runtime-export`. Jangan mengganti test gate Playwright dengan browser service lain tanpa PR khusus.

PinchTab boleh dipakai sebagai browser service utama untuk eksplorasi dan bukti visual lokal, selama tetap ditutup dengan gate Playwright sebelum PR diajukan atau di-merge.

### Kapan pakai Playwright

Pakai Playwright untuk:

1. Semua acceptance gate yang sifatnya pass atau fail.
2. Smoke test editor preview dan ZIP export.
3. Assertion runtime yang perlu stabil dan bisa diulang di CI.
4. Verifikasi bugfix yang harus diturunkan jadi test deterministik.
5. Bukti teks di PR, seperti output `npm run smoke:map` atau targeted Playwright test.

### Kapan pakai PinchTab

Pakai PinchTab untuk:

1. Eksplorasi UI interaktif di browser dengan profile persistent.
2. Debug manual ketika agent perlu melihat state browser yang panjang.
3. Reproduce bug user sebelum diturunkan menjadi test Playwright.
4. Ambil screenshot editor, runtime preview, atau state UI lain untuk lampiran PR.
5. Validasi visual cepat, termasuk cek layout, sticky toolbar, overflow, urutan section, dan affordance tombol.
6. Interaksi manual seperti import ZIP lokal, klik, scroll, snapshot accessibility, network, dan console, jika endpoint yang dibutuhkan memang diizinkan oleh konfigurasi PinchTab lokal.

### Workflow browser yang berlaku sekarang

1. Reproduce atau eksplorasi dulu dengan PinchTab jika kasusnya visual, panjang, atau butuh browser state persistent.
2. Jika butuh forensic JS runtime yang lebih dalam, pindah ke `chrome-devtools`.
3. Setelah root cause atau expected behavior jelas, tutup dengan Playwright.
4. Sebelum buka PR, bukti minimal tetap wajib:
   - screenshot editor
   - screenshot ZIP runtime
   - output Playwright gate yang PASS
5. Screenshot PR boleh diambil dengan PinchTab atau Playwright. Namun validasi final tetap harus datang dari Playwright.

### Keputusan praktis untuk repo ini

- **Screenshot PR:** boleh pakai PinchTab sebagai tool utama karena cepat, persistent, dan nyaman untuk UI walkthrough.
- **Validasi visual manual:** boleh mulai dari PinchTab.
- **Modify UI lewat interaksi browser:** boleh pakai PinchTab untuk memicu state UI, import fixture, klik kontrol, dan cek hasil visual.
- **Gate merge:** tetap Playwright.
- **CI:** tetap Playwright.

Aturan keamanan PinchTab:

1. Bind tetap di `127.0.0.1`.
2. Token API wajib aktif.
3. Sensitive endpoints tetap disabled kecuali user eksplisit minta. Jika `upload` diaktifkan untuk workflow lokal, catat bahwa itu hanya untuk trusted local environment.
4. Website whitelist default hanya lokal. Perluasan domain harus disengaja dan dicatat.
5. Jangan pakai PinchTab untuk menyimpan secret, cookie, atau state login ke repo.

## Maintenance plugin superpowers (OpenCode)

Plugin terpasang lewat `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git"
  ]
}
```

### Bagaimana caching bekerja

OpenCode resolve `git+https://...` saat install pertama, lalu kunci ke commit hash di lockfile lokal:

```
~/.cache/opencode/packages/superpowers@git+https:/github.com/obra/superpowers.git/
├── package-lock.json   ← berisi commit hash spesifik
└── node_modules/superpowers/
    ├── .opencode/plugins/superpowers.js
    └── skills/   (14 skill)
```

Session berikutnya baca lockfile, langsung pakai commit yang sama. **Tidak ada git fetch ulang otomatis**, sengaja begitu supaya behavior plugin reproducible dan tidak tiba-tiba berubah saat upstream merge breaking change.

### Cara update manual

Cek release baru di https://github.com/obra/superpowers/releases, baca catatannya, lalu force update:

```bash
opencode plugin -f superpowers@git+https://github.com/obra/superpowers.git
# atau brute force, hapus cache lalu start session baru:
rm -rf "$HOME/.cache/opencode/packages/superpowers@git+https:/"
```

Setelah update, smoke test:

```bash
opencode run "list available skills"
# pastikan 14 skill masih muncul
opencode mcp list
# pastikan 3 MCP masih connected
opencode agent list | grep -E "(map-doctor|qa-runner|pr-reviewer|phase-implementer|lib-researcher)"
# pastikan 5 subagent project utuh
```

Kalau ada regression, rollback dengan pin ke commit/tag sebelumnya:

```json
"plugin": ["superpowers@git+https://github.com/obra/superpowers.git#<commit-atau-tag>"]
```

### Cadence yang disarankan

- **Bulanan**, atau setelah baca release notes baru. Tidak perlu real time.
- **Hindari update saat Codex lagi mid-fase**. Tunggu sampai fase selesai dan QA pass, baru update plugin. Mengurangi noise saat debug.
- **Setelah update**, run `verify-map-render` skill untuk pastikan tidak ada interaksi negatif dengan workflow domain.

### Disable cepat tanpa hapus file

Kalau plugin perlu di-bypass tiba-tiba (mis. lagi reproduce bug yang dicurigai dari plugin):

```bash
opencode --pure run "..."   # jalankan satu shot tanpa plugin eksternal
```

Atau kosongkan array `plugin` di `opencode.json` sementara.

## Logging perubahan

Setiap PR yang merge harus append entry di root [../AGENTS.MD](../AGENTS.MD) sesuai format di sana, dengan minimal: ID fase, file yang diubah, hasil tes, path screenshot.
