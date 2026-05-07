DONE

Commit SHA: 89564ae
Commit message: docs(qa): add phase 9 evidence and checklist

Evidence files
- docs/QA-CHECKLIST-PER-PHASE.md
- docs/screenshots/phase-9/editor-20260504-103652.png
- docs/screenshots/phase-9/npm-run-build-20260504-103652.txt
- docs/screenshots/phase-9/npm-run-smoke-fixture-20260504-103652.txt
- docs/screenshots/phase-9/npm-run-smoke-export-20260504-103652.txt
- docs/screenshots/phase-9/npx-playwright-phase-9-20260504-103652.txt

Checklist update
- Added Phase 9 section to docs/QA-CHECKLIST-PER-PHASE.md
- Included required bullets for layer search, diagnostics visibility, served WMS runtime requests, served PMTiles runtime fetch, Phase 7 regression pass, and Phase 8 regression pass
- Included exact Task 5 deferral note:
  WMS GetFeatureInfo remains deferred after Phase 9 review because the current imported fixture and runtime config preserve tile rendering parity, but do not yet carry a bounded, testable click-info contract without widening scope into a larger runtime interaction redesign.

Command results
- npm run build: PASS
  - Log: docs/screenshots/phase-9/npm-run-build-20260504-103652.txt
- npm run smoke:fixture: PASS
  - Log: docs/screenshots/phase-9/npm-run-smoke-fixture-20260504-103652.txt
- npm run smoke:export: PASS
  - Log: docs/screenshots/phase-9/npm-run-smoke-export-20260504-103652.txt
- npx playwright test tests/map-render.spec.ts -g "phase 7|phase 8|phase 9": PASS
  - 13 passed
  - Log: docs/screenshots/phase-9/npx-playwright-phase-9-20260504-103652.txt

Screenshot capture
- Captured editor screenshot with visible Phase 9 UI state by importing fixture in dev server and filling the side panel layer search field.
- Screenshot path: docs/screenshots/phase-9/editor-20260504-103652.png

Notes
- No app source changes were made for Task 7.
- Used git add -f for docs artifacts as required.
- Working tree still has unrelated untracked local files outside this task scope, but the task commit itself is complete and recorded.
