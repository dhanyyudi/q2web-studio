# Contributing to q2webstudio

Thanks for contributing to q2webstudio. This repo uses a phase based workflow with strict parity checks for editor preview, runtime preview, and ZIP runtime.

## Development setup

```bash
npm install
npm run dev
```

Useful supporting commands:

```bash
npm run build
npm run smoke:fixture
npm run smoke:export
npm run smoke:map
```

Read these project rules before changing files:

- [AGENTS.md](AGENTS.md)
- [docs/agents/rules.md](docs/agents/rules.md)
- [docs/QA-CHECKLIST-PER-PHASE.md](docs/QA-CHECKLIST-PER-PHASE.md)
- [docs/AUDIT-2026-05-01-v4.md](docs/AUDIT-2026-05-01-v4.md)

## Required verification

Before opening a PR, run the relevant verification commands for your scope.

Minimum expected commands for most app changes:

```bash
npm run build
npm run smoke:fixture
npm run smoke:export
npm run smoke:map
```

If your change touches map rendering, runtime preview, export, import, hydration, migration, schema, parser behavior, or other high blast radius files, also run the relevant Playwright gate from `tests/map-render.spec.ts`.

Example:

```bash
npx playwright test tests/map-render.spec.ts -g "phase 7|phase 8|phase 9|phase 10" --reporter=line
```

## PR rules

- Keep one phase or one concern per PR.
- Do not bundle unrelated refactors with the requested fix or feature.
- Add `@codex` in the PR body and in every follow up PR reply so the review loop keeps the same context.
- If the change touches editor preview, runtime preview, ZIP export, hydration, migration, import, or schema, include a manual parity sweep in the PR description.
- Do not claim completion without attaching relevant evidence and command output.

## Manual parity sweep

When parity matters, the PR description should state what was checked across these paths:

- Editor preview
- Runtime preview
- Exported ZIP runtime served over `python3 -m http.server`

The sweep should mention the specific behavior changed, the fixture used, and any intentionally deferred gaps.

## Evidence folders

Store screenshots and logs under phase folders in `docs/screenshots/`.

Examples:

- `docs/screenshots/phase-9/`
- `docs/screenshots/phase-10/`

At minimum, attach:

- Editor screenshot
- ZIP runtime screenshot
- Relevant build, smoke, and Playwright logs

## Scope guardrails

- Do not disable `React.StrictMode`.
- Do not add permanent debug globals or console noise.
- Treat editor preview and ZIP runtime as separate test paths.
- Use the smallest responsible change in hot files such as `src/App.tsx`, `src/runtime/runtime.ts`, `src/components/MapCanvas.tsx`, and `src/lib/qgis2webParser.ts`.
- Do not widen WMS GetFeatureInfo, rule based styling, or custom CRS reprojection without a dedicated plan and scope approval.
- Do not change `.opencode/agent`.

## Architecture references

For implementation context, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Disclaimer

q2webstudio is an independent editor for qgis2web exports and is not affiliated with qgis2web or OSGeo.
