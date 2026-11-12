# Compact guided UI

The current page shows every instruction and action at once. Replace it with a desktop workspace: persistent camera on the left, one focused task on the right, and three stages (Teach, Calibrate, Present). Teach one label at a time and move to the next label after three clips. Advance to calibration after training, then presentation after successful calibration. Earlier stages remain revisitable without losing completed examples; editing examples still invalidates calibration.

Use actual shadcn components with Base UI, React and Tailwind through Vite. Keep `features.mjs`, `recording.mjs`, `classifier.mjs`, `calibration.mjs`, and `commands.mjs` intact. Extract the browser controller from DOM rendering so the new view consumes state without changing the learning math. A compact status and primary action replace repeated instructions; optional help/diagnostics carry the longer explanations. Desktop setup and presentation should fit a normal laptop viewport; narrow screens may stack naturally.

Implementation scope:
- Add shadcn project configuration and only the components used by the view.
- Add `session.mjs` for the existing recording/calibration/command lifecycle and guided navigation, with real numerical/session tests replacing the old fake-DOM entry-point checks.
- Add `camera.mjs` for model loading, video-only camera access, fresh-frame detection, overlay and cleanup.
- Add the React view and responsive theme; remove the old all-at-once markup/DOM controller.
- Run the full suite and production build, inspect the rendered UI when browser tools are available, and review safety and workflow transitions.

Preserve calibration rejection, three clips per label, the five calibration captures, hold/rearm, explicit start/resume, Escape, hidden-tab pause, camera cleanup, and in-memory-only examples. Styling work refreshes the page and clears the existing session. No persistence, extra gesture commands, deck uploads, external presentation control or decorative animation in this change.

## Outcome

- Implemented the three guided stages with persistent camera, automatic progression, per-pose retake, clip/capture/hold progress, a styled six-slide deck and collapsible help/diagnostics. Use shadcn Base Nova with a restrained violet theme and bundled Geist font.
- `session.mjs` replaces DOM-driven state; `camera.mjs` owns the existing camera/model/overlay lifecycle. The five learning and command modules above are unchanged. The obsolete fake-DOM tests were replaced with direct session/camera tests and rendered React checks.
- Review caught and fixed early label switching, stale presentation feedback and inaccessible cancellation during camera startup. Tests reproduce each behavior. A shared pending model load avoids duplication during stop/restart.
- Verified: 54 tests passed, none skipped; production build and `git diff --check` passed. Dependency versions are pinned; the lockfile was refreshed. The local Vite server was restarted with the new React/Tailwind configuration.
- Browser preview tooling failed (native pipe unavailable/timeout). Rendered React checks cover task visibility, current presentation blockers and startup cancellation; no visual screenshot QA or new physical webcam trial was completed. The updated site is local and has not been deployed.
