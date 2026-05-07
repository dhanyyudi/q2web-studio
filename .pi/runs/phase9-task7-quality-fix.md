DONE

Commit SHA: a49f85d

Evidence paths:
- docs/QA-CHECKLIST-PER-PHASE.md
- docs/screenshots/phase-9/editor-20260504-103652.png
- docs/screenshots/phase-9/runtime-20260504-034249.png
- docs/screenshots/phase-9/npm-run-build-20260504-103652.txt
- docs/screenshots/phase-9/npm-run-smoke-fixture-20260504-103652.txt
- docs/screenshots/phase-9/npm-run-smoke-export-20260504-103652.txt
- docs/screenshots/phase-9/npx-playwright-phase-9-20260504-103652.txt
- docs/screenshots/phase-9/npx-playwright-phase-7-8-9-20260504-104313.txt

Commands used:
- node .pi/runs/phase9_runtime_screenshot.mjs
- npx playwright test tests/map-render.spec.ts -g "phase 7|phase 8|phase 9" --reporter=line 2>&1 | tee docs/screenshots/phase-9/npx-playwright-phase-7-8-9-20260504-104313.txt
- git add -f docs/QA-CHECKLIST-PER-PHASE.md docs/screenshots/phase-9/runtime-20260504-034249.png docs/screenshots/phase-9/npx-playwright-phase-7-8-9-20260504-104313.txt
- git commit -m "docs(qa): add phase 9 runtime evidence"

Notes:
- Phase 9 checklist now has an explicit acceptance and evidence bundle subsection that requires editor screenshot, ZIP runtime screenshot, build log, smoke fixture log, smoke export log, and Playwright phase 7, 8, and 9 log.
- Runtime preview screenshot was attempted through the existing Preview flow, but was not required for completion and was not persisted because the ZIP runtime screenshot is the mandatory blocker item.
