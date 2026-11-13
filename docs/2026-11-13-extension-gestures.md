# Extension gesture integration

Approved scope: reuse Teach → Calibrate → Present in the Chrome extension,
control the selected Google Slides deck through the existing command gate, and
automatically save one local setup. Restore training only; require fresh
calibration and explicit start. No accounts, cloud sync, or named profiles.

## Implementation checklist

- [x] Add versioned training export/restore/reset to GestureSession, validating
      labels, clip counts, finite 42-number vectors, and sample counts. Emit commands
      to an optional adapter, retaining the demo behavior by default. Test both.
- [x] Add a local storage binding with ordered writes, visible failures and
      retry. Save completed clips and retakes only, never camera frames, calibration,
      target tabs, or armed/running state. Test corrupt data and write failures.
- [x] Connect the session to Slides with explicit start, mutual pause,
      cancellation of in-flight resume, no queued commands, and Neutral rearm.
      Test real recognition sequences plus target loss, camera loss and pause.
- [x] Reuse App with an optional Present panel and footer for extension setup
      status/reset. Adapt narrow layout; keep one persistent camera. Preserve web
      demo defaults. Update manifest, version, install docs and release package.
- [x] Run tests, format checks, web/extension builds and archive checks. Inspect
      the built extension UI in Chrome. Physical gesture accuracy remains a user
      check; no synthetic data should be saved into their real profile.

Review focus: malformed/older saved setups, late/out-of-order storage writes,
camera or tab loss while resume is pending, pending holds during disconnect,
and preserving the public demo. Work in the requested existing workspace and
preserve its uncommitted extension changes.

Review fixed stale asynchronous results pausing a newer session, and read
failures presenting a save action that could overwrite unread training. Both
have regression tests. Chrome confirmed all three stages and packaged camera
start/stop in version 0.2.0. No test training was saved into the user's setup.
Physical gesture control and restore after real training remain user checks.
Final verification: 99 tests passed, none skipped; web and extension builds,
Prettier, git diff whitespace check, and ZIP/resource integrity checks passed.
