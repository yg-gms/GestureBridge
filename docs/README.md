# Project guide

Start with the root [README](../README.md) for running and using GestureBridge.

| File                           | Responsibility                                            |
| ------------------------------ | --------------------------------------------------------- |
| `src/main.jsx`                 | Starts React and connects the camera and session          |
| `src/App.jsx`                  | Guided Teach, Calibrate and Present interface             |
| `src/components/ui/`           | Generated shadcn components; keep their standard APIs     |
| `session.mjs`                  | Coordinates setup, progress, messages and slide controls  |
| `camera.mjs`                   | Camera access, model loading, landmarks and cleanup       |
| `features.mjs`                 | Normalizes hand position, size and sideways rotation      |
| `labels.mjs`                   | Shared names for Next, Previous and Neutral               |
| `recording.mjs`                | Collects three separate clips for each pose               |
| `classifier.mjs`               | Measures distances and compares the five closest examples |
| `calibration.mjs`              | Sets a rejection limit from fresh known/unrelated poses   |
| `commands.mjs`                 | Hold once, rest to rearm, and interruption rules          |
| `extension/main.jsx`           | Extension workspace, local setup and camera lifecycle     |
| `extension/gesture-slides.mjs` | Connects gated gestures and Slides pause state            |
| `extension/training-store.mjs` | Saves/restores versioned training locally                 |
| `extension/slides.mjs`         | Binds one Slides tab and verifies navigation              |
| `tests/`                       | Numerical, camera, workflow and rendered-component checks |

## Hand tilt

Feature vectors remain 42 numbers. After wrist-relative position and scale
normalization, rotate the points so the wrist-to-middle-knuckle direction is
upright. The user's `normalizeCoordinates` calculation is unchanged. Finger-shape
differences remain; rotating the whole shape within the camera image is ignored.
Tests cover ±20° and ±30° rotations in pixel coordinates on a non-square image and
classification of the rotated shape. Existing position/scale tests still pass.

This does not correct 3D foreshortening, occlusion or landmark-estimation errors
when turning the palm toward/away from the camera. Physical tilt tolerance still
needs a fresh recording/calibration trial. No old examples should be reused after
the feature representation changes. The extension validates the saved feature
version on restore; reset saved training after changing that representation.

## How training cleanup works

For each complete 15-sample clip, find the medoid (the recorded sample with the
smallest total distance to the others). Compare each sample's distance from it
with the median distance plus three scaled median absolute deviations (MAD).
Use an initial minimum allowance of 0.1 in normalized Euclidean-distance units
when the samples are almost identical. Keep at least 12 samples; otherwise ask
for a retake without modifying earlier clips. These are starting heuristics for
physical testing, not calibrated guarantees.

Classification, fresh calibration and command timing are unchanged. The existing
recording message reports discarded samples and retakes in plain language.
Yigit's normalization and distance calculations are preserved.

The filter checks consistency, not intent: a consistently wrong pose still
appears consistent. Broad or structured changes can also escape a distance-based
outlier check. It does not guarantee rejection of unfamiliar poses. Physical
trials should include natural movement, one brief accidental pose, mixed-pose
clips and separate clean clips with different hand orientations. Recalibrate
after recording; evaluation attempts must stay separate from training.

## Repository maintenance

- Run `npm run format:check`, `npm test`, `npm run build` and `git diff --check`.
- Formatting skips generated shadcn components, model/runtime assets, lockfiles,
  build output and archived notes.
- The npm audit on November 13 reported six advisories in the existing shadcn
  development-tool chain. `npm audit --omit=dev` reported none. No forced package
  upgrades were included with the recording change.
