# Google Slides release plan

Decision: first integration is **Google Slides in desktop Chrome**, selected by
Yigit on November 13. Keep the public web app as a no-install demo and ship an
extension beta for controlling a real presentation. This expands the original
demo-only scope; PowerPoint is a separate later integration.

## What the prize actually rewards

The [IceHacks shipped-app track](https://icehacks.devpost.com/) names a live public
URL, reliability, completeness and documentation. A store listing is not an
explicit requirement in that description. Keep the HTTPS demo and clear install
instructions usable even if extension review is pending. Do not present a
developer-mode beta as an approved store release.

The [official submission schedule](https://icehacks.devpost.com/details/dates)
ends November 15 at 18:00 PST, which is November 16 at 10:00 Hong Kong time.
Keep the earlier internal submission target of November 15 at 20:00 HKT.

## First milestone: prove the connection

Build a small Manifest V3 extension with manual Next, Previous and Pause controls
before moving webcam recognition into it. On a disposable Google Slides deck:

1. Attach to one explicitly selected Slides tab and detect slideshow mode.
2. Prove Next and Previous work in the real slideshow, including fullscreen.
3. Verify repeated commands, first/last slide boundaries, slide animations,
   speaker notes/presenter view and return from fullscreen.
4. Pause on switching away, closing/navigating the target or losing connection.
   Discard stale commands; reconnect disarmed with an explicit resume.
5. Clearly report unsupported page state instead of claiming a command worked.

Chrome [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
can interact with a page's DOM. The exact Slides navigation mechanism still
needs a live feasibility check: do not assume a synthetic keyboard event is
equivalent to a physical keypress. Prefer a verified visible navigation control
and fail clearly if the adapter no longer recognises the supported slideshow UI.
Avoid private Google JavaScript internals and broad browser/debugger permissions
as the default design.

The [Slides REST API](https://developers.google.com/workspace/slides/api/reference/rest)
provides document reads/edits, not a documented live slideshow Next/Previous
endpoint. Adding OAuth alone would not solve this integration.

## Connect the existing recognition engine

Keep the pure feature, recording, cleaning, classification, calibration and
command-gate modules. Separate an emitted command from the built-in deck's
`slideIndex` update; adapters can then target the demo or the selected Slides tab.

- Use an extension side panel for setup, connection state, pause and camera-off.
- Prototype a dedicated camera engine that survives closing setup/fullscreen.
  Chrome's [offscreen document API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
  supports a `USER_MEDIA` reason; actual camera permission, MediaPipe/WASM loading,
  inference timing and shutdown in this context must be tested before committing
  to that implementation.
- Bundle model/runtime/code assets. Test extension content-security policy and
  WebAssembly support; do not fetch executable code from a CDN.
- Tie each command to the selected tab and active control session. Check sender,
  target, command type and freshness; do not queue old slide commands for replay.
- Keep 500 ms command hold, one activation, 400 ms valid Neutral rearm and
  explicit start/resume. Camera failure, target loss and disconnect must disarm.
- The current hidden-page pause rule cannot simply be removed: replace its
  ownership with presentation visibility/focus checks. A hidden processing
  document does not mean the user has left the presentation.

## Small features needed for a usable release

1. **Save and forget a local profile:** explicit save/delete; numeric examples
   only. Validate restored data and record a feature-format version so future
   normalization changes cannot silently reuse incompatible vectors. Require a
   fresh calibration on a restored profile rather than trusting old conditions.
2. **Connection feedback:** identify the bound deck/tab, show live/paused/lost
   states and keep Pause/Stop camera reachable during a real presentation.
3. **Pose-separation guidance:** show which trained shapes are confused and let
   the user retake that label. Rotation-only differences no longer distinguish
   gestures after alignment.
4. **Clear onboarding:** install, grant camera access, teach, calibrate, connect,
   present; provide a short supported-browser/mode list and troubleshooting.

Keep additional normalization driven by test failures. Current position, scale,
sideways rotation and within-clip outlier cleaning are a reasonable baseline.
Investigate 3D/world-landmark or joint-angle features only if modest out-of-plane
tilt remains a demonstrated problem. Decide how to warn about changing hands;
avoid silently merging left/right profiles before testing that behavior.

## Evidence before calling it shipped

Use fresh attempts after fixing settings, with at least one additional person if
available. Record actual outcomes; these are acceptance targets, not current
results.

| Trial                                       | Evidence to collect                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Fresh setup and restored profile            | Setup time, confusing steps, permission allow/deny/retry                                  |
| Ten Next and ten Previous attempts          | Correct single command within two seconds; misses, wrong commands, duplicates and latency |
| ±20–30° sideways tilt                       | Results for each trained shape at each angle, in physical webcam trials                   |
| Ordinary movement / talking                 | Accidental commands over 60 seconds                                                       |
| No hand / two hands / tracking interruption | No accidental action; pending hold clears and Neutral is required                         |
| Fullscreen and presenter view               | Commands affect the intended audience deck; supported modes explicitly listed             |
| Switch tab / target closes / reconnect      | Pause, no wrong-tab commands, no delayed replay, explicit resume                          |
| Lighting, distance, hand choice             | Document tested conditions and any required recalibration                                 |
| Network inspection and camera-off           | No frame uploads; media tracks released when stopped                                      |
| Fresh installation from release package     | Another person can install, set up and operate it using only the docs                     |

## Distribution

Release a versioned extension ZIP and installation instructions, maintain the
public HTTPS demo, and prepare a minimal privacy policy and supported-mode list.
Submit to the Chrome Web Store once the beta is validated. Chrome documents
[review times from days to weeks](https://developer.chrome.com/docs/webstore/review-process),
so approval cannot be promised before the hackathon deadline. Describe review
status accurately and provide a recorded real-deck demonstration as backup.

For later PowerPoint support, Microsoft's [official add-in tutorial](https://learn.microsoft.com/en-us/office/dev/add-ins/tutorials/powerpoint-tutorial-yo)
demonstrates Next/Previous through `goToByIdAsync`. A separate spike must verify
camera permissions and execution in the target PowerPoint slideshow mode before
promising desktop or web support.

## First spike built — November 13

Added a separate extension build and ready-built ZIP with manual controls, one-tab
binding, explicit pause/resume, stale-command rejection and packaged camera/model
check. See [installation and the short test](../extension/README.md).

The adapter accepts a standard `/present` or `/preview` Google Slides page and
requires a readable slide token in the URL. It tries accessible navigation
controls, falling back to arrow-key events, and only reports success when the
slide token changes. No-change, unsupported-state and navigation errors pause
control instead of claiming success. Animation-only steps are not verified.

Version 0.1.1 was checked in the user's desktop Chrome on November 13. Connect,
Resume, Next and Previous worked on a real Slides deck; both directions reported
confirmed slide changes and kept the connection alive. The camera setup tab
displayed Chrome's permission prompt, and the panel subsequently showed Camera
ready and One hand tracked using the packaged model/WASM. The test ended paused
with the camera stopped. These checks do not establish fullscreen or presenter
view compatibility, network privacy verification, or broad recognition accuracy.

The fixes use an explicit toolbar action to grant activeTab access, a normal tab
for initial camera permission, and both query-string and hash slide positions.
Slides query updates can report loading; those updates no longer disconnect a
valid deck. Reloads without a supported URL update still disconnect.

No gesture commands, offscreen camera engine, store approval or physical
benchmarks are claimed for this spike. Keep the public web demo working separately.

## Gesture beta built — November 13, version 0.2.0

The extension now reuses Teach → Calibrate → Present, routes the existing gated
Next/Previous events to the selected Slides tab, and automatically saves completed
training clips locally. Restore validates the schema/features and requires fresh
calibration, explicit start and Neutral rearm. Retake and Reset setup persist;
storage errors expose the appropriate load/save retry. No video, calibration,
target tab or active-control state is saved.

Synthetic recognition and adapter tests cover single-fire/rearm, tab/connection
loss, camera loss, canceled starts and stale asynchronous results. Version 0.2.0
was loaded in desktop Chrome; the three setup stages and camera start/stop were
checked. The physical train → calibrate → gesture → Slides test and restore after
actual training remain user checks. Fullscreen remains unverified.
See [beta install and acceptance check](../extension/README.md).
