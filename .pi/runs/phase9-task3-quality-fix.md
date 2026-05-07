# Phase 9 Task 3 quality fix

## Summary
Fixed the stale layer search blocker in `src/components/SidePanel.tsx` by resetting local `layerQuery` whenever the imported project identity changes. The reset key is derived from `project.importedAt` and `project.indexHtmlPath`, which keeps the fix small and tied to import level changes.

## Files
- `src/components/SidePanel.tsx`: added a small `useEffect` reset for `layerQuery` on project identity change, and imported `useEffect`

## New deps
- None

## Test results
- `npx playwright test tests/map-render.spec.ts -g "phase 9 side panel|phase 9 diagnostics" --reporter=line`: PASS, 2 passed

## Commit
- `b9f0e9d` `fix(ui): reset layer search on project change`

## Risk / follow-up
- The reset also runs when project becomes `null`, which is safe because it only clears local search state.
- No extra test was added because the requested targeted Phase 9 side panel and diagnostics coverage already passes, and scope was kept minimal.

## Next
- Handoff ke qa-runner phase=9
