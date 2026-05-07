# Pi Harness, qgis2web Studio

Project ini memakai Pi sebagai runtime agent tambahan di samping OpenCode dan Codex.

## Isi Folder

| Path | Fungsi |
|---|---|
| `settings.json` | Paket Pi project dan opsi skill command |
| `agents/` | Subagent Pi hasil port dari `.opencode/agent/` |
| `extensions/` | Extension project-local untuk command workflow |
| `skills/` | Skill native Pi yang mirror `docs/agents/skills/` |
| `mcp.json` | Override MCP lokal berisi token atau header rahasia. File ini di-ignore |

## Paket Pi

Pi akan membaca paket project dari `.pi/settings.json`.

```bash
pi install -l npm:pi-subagents
pi install -l npm:pi-mcp-adapter
pi install -l npm:pi-web-access
pi install -l git:github.com/obra/superpowers@e7a2d16476bf042e9add4699c9d018a90f86e4a6
```

## Superpowers

OpenCode memakai plugin `superpowers` lewat `.opencode/plugins/superpowers.js`.

Pi tidak menjalankan plugin OpenCode itu. Pi memakai repo yang sama sebagai package skill-only. Paket `git:github.com/obra/superpowers@e7a2d16476bf042e9add4699c9d018a90f86e4a6` dimuat dari `.pi/settings.json`, lalu Pi auto-discover folder `skills/` di package tersebut.

Yang tersedia di Pi:

- Skill seperti `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `writing-plans`, dan `subagent-driven-development`.
- Pemanggilan via skill command jika Pi runtime yang dipakai expose skill commands.

Yang tidak otomatis tersedia di Pi:

- OpenCode native command `skill <nama>`.
- Hook OpenCode dari `.opencode/plugins/superpowers.js`.
- Command wrapper OpenCode seperti `brainstorm`, `write-plan`, dan `execute-plan`, kecuali di-port lagi sebagai Pi prompts atau extension.

## Command Workflow

Project ini punya extension lokal di `extensions/plan-build.ts`.

Command:

```text
/plan <scope>
/build <scope>
/ctx
/context-usage
```

Contoh:

```text
/plan Phase 0 hotfix map kosong, jangan edit kode dulu
/build Phase 0 hotfix map kosong, scope hanya MapCanvas dan test terkait
/ctx
```

`/plan` mengirim prompt read-only untuk membuat plan. `/build` mengirim prompt implementasi dengan guardrail q2web Studio. Jika agent sedang berjalan, command akan di-queue sebagai follow-up.

`/ctx` menampilkan perkiraan context-window usage dari session Pi saat ini. Setelah `/compact`, angka bisa `unknown` sampai ada assistant response baru.

## MCP

Konfigurasi shared ada di `.mcp.json`.

Token Context7 tidak disimpan di `.mcp.json`. Token disimpan lokal di `.pi/mcp.json`, dan file itu wajib tetap ignored.

PinchTab tersedia sebagai MCP tambahan lewat `pinchtab mcp`. Service lokal dipasang sebagai daemon user-level dengan `pinchtab daemon install`. Playwright tetap menjadi QA gate resmi. PinchTab hanya untuk eksplorasi browser interaktif dan stateful debug.

## Contoh Pakai

```text
/run qa-runner "phase=0, jalankan verification gate"
/run map-doctor "debug map kosong setelah import fixture"
/parallel pr-reviewer "review diff terhadap rules.md" -> qa-runner "phase=0 smoke gate"
```

Setelah mengubah agent, skill, MCP, atau settings, restart Pi atau jalankan `/reload`.
