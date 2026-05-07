# Phase 8 Task 1 quality fix done

## Summary
Pre raster layer affordances are now explicit and safe in the side panel. Non vector layers can no longer be silently selected into a vector only inspector flow, and their visibility toggle no longer advertises a control that would no op. Raster entries now show an explicit preview only message until inspector support lands in Task 4.

## Files
- `src/components/SidePanel.tsx`: disabled select and visibility controls for non vector layers, added explicit preview only copy and titles
- `src/styles.css`: added disabled styling for non vector layer rows and kept disabled controls tooltip friendly

## New deps
- None

## Test results
- `npm run build`: PASS
- `npm run smoke:fixture`: PASS

## Risk / follow-up
- Raster rows are intentionally non interactive for selection and visibility in the side panel until raster inspector and render parity are implemented.
- `MapCanvas` and `useProjectState` still use vector only effective selection, but the misleading path is now blocked from the UI layer.
- ZIP runtime path was not changed because this task is limited to pre render editor affordances.

## Commit
- `fix(raster): guard pre-render layer affordances`
- Commit SHA: `83574c3`

## Next
- Handoff ke qa-runner phase=8-task1