# q2webstudio Roadmap

## Status

Audit V4 MVP is complete through Phase 10.

Phase 11 is final gap triage and roadmap lock, not a hidden feature phase. This document is the canonical post Audit V4 roadmap and deferral register so shipped MVP scope stays clear.

## Shipped MVP boundary

The current MVP covers the editor and runtime workflow already implemented through Phase 10, including local preview and export flows for the supported qgis2web Leaflet path.

The current boundary is intentionally narrow:

- WMS tile rendering parity is supported, but WMS GetFeatureInfo is not shipped.
- Vector style modes remain limited to `single`, `categorized`, and `graduated`.
- Runtime preview is local to the browser session and Service Worker route, while project autosave remains local via OPFS.
- Authentication and collaboration are not part of the shipped MVP.

## Deferral register

### WMS GetFeatureInfo

Status: Deferred.

Current support for WMS is tile rendering parity only. WMS GetFeatureInfo needs a dedicated contract for parser metadata, runtime click behavior, popup rendering, request construction, and CORS failure handling. This remains deferred until a dedicated future plan expands scope.

### Rule based styling

Status: Deferred.

Rule based styling is not implemented in the current MVP. Supporting it would require expression parsing, a stable project schema contract, editor UX, runtime parity, and export validation. This remains deferred.

### Custom CRS reprojection

Status: Deferred.

Custom CRS reprojection is not implemented in the current MVP. The current app assumes qgis2web Leaflet exports already provide coordinates consumable by Leaflet. Full support would require CRS detection, warning UX, projection library decisions, export behavior, and test coverage. This remains deferred.

### Cross device preview links

Status: Deferred, post Audit V4.

Cross device preview links are not part of the local Service Worker preview model used by the current MVP. Delivering shared preview links would require backend storage and hosted preview infrastructure such as Cloudflare KV or Pages Functions, plus lifecycle and security decisions. This remains future work.

### IndexedDB preview persistence

Status: Deferred, post Audit V4.

Project autosave already uses local OPFS persistence. IndexedDB preview persistence is a separate preview route concern and would need a dedicated lifecycle, storage invalidation, and migration plan.

### Offline PMTiles caching

Status: Deferred, post Audit V4.

Offline PMTiles caching is out of scope for final Audit V4 closure. It requires separate storage, cache management, quota handling, and runtime verification work.

### GitHub OAuth

Status: Deferred, post Audit V4.

GitHub OAuth is not part of the shipped MVP. It introduces a separate authentication subsystem, identity flows, and deployment considerations. It remains deferred to a future dedicated plan.

### Real time collaboration

Status: Deferred, post Audit V4.

Real time collaboration is not part of the shipped MVP. It is a separate product subsystem involving shared state, conflict handling, presence, and backend coordination. It remains deferred to a future dedicated plan.

## Roadmap policy

Large future systems listed here should not be bundled into small cleanup PRs. Each item needs its own dedicated plan, explicit scope, fixtures, tests, and parity checks before implementation begins.

## Immediate next step

Use this roadmap as the source of truth for post Audit V4 deferments while keeping Phase 11 limited to documentation, closure evidence, and regression boundaries.
