# GestureBridge for Google Slides — 0.2.0 beta

Teach custom Next, Previous and Neutral poses, calibrate them, and control a real
Google Slides deck. One setup saves automatically on this computer. No account
or server is required; no webcam footage is saved.

## Install or update

1. Unzip the release into a folder you will keep on your computer.
2. In desktop Chrome 116+, open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
   From source, run `npm run build:extension` and select `dist-extension/`.
   The packaged ZIP needs no Node/npm. For an existing unpacked install, rebuild
   in the same folder and click its **Reload** button.
4. Pin GestureBridge through Chrome's Extensions menu. Open your Slides deck
   and click the GestureBridge toolbar icon there to grant temporary tab access.

## Teach → Calibrate → Present

1. **Start camera.** On first use, a setup tab opens. Click **Allow camera
   access**, accept Chrome's prompt, close that tab, and start the camera again
   in the Slides panel. Use the same hand throughout setup and presentation.
2. **Teach.** Record three short clips for each of Next, Previous and Neutral.
   Relax and reposition between clips. Clips save only after they complete;
   closing the panel during a capture discards that incomplete capture.
3. **Calibrate.** Complete five fresh captures. If calibration fails, retry or
   retake poses that look too similar.
4. **Present.** Choose **Open slideshow**, wait for it to load, then **Connect
   Slides tab**. Click **Start gesture controls**.
5. Hold Neutral for 0.4 seconds, then Next or Previous for 0.5 seconds. Each
   command fires once. Hold Neutral again before the next command.
6. Use **Pause controls** or Escape while the panel has focus to pause. Keep
   the panel open. Hiding/closing it pauses controls; closing it stops the camera.

On reopening, saved clips return but fresh calibration is required. Controls
always start paused and disarmed. **Retake** replaces one pose; **Reset setup**
clears all saved poses. Wait for “Poses saved” before closing. Saving errors
remain visible with a retry action. Removing the extension clears local storage.

## Quick acceptance check

Use a disposable deck with at least three slides and no animations. After setup,
try ten Next and ten Previous gestures, checking for single moves and Neutral
rearm. Pause during a partial hold, then start again: no command should fire
before fresh Neutral. Switch tabs/windows and back: controls must stay paused
until you explicitly start again. Stop the camera and verify its indicator goes
off. Reopen the panel and verify poses return with calibration required.

Fullscreen, presenter view, animations and different people's physical gesture
accuracy still need testing. Keep browser presentation mode with the panel
visible as the beta workflow. Published decks and speaker-notes windows are not
supported. If no slide change is confirmed, controls pause instead of claiming
success. First/last-slide boundaries can also cause this pause.

## Permissions and privacy

- `activeTab` grants temporary access to the tab where the toolbar is clicked;
  `scripting` performs navigation there; `sidePanel` provides the interface.
- `storage` saves one versioned set of pose measurements and clip counts locally.
  Calibration, camera footage, target tab and active-control state are not saved.
  Pose storage is limited to trusted extension contexts, without cloud sync.
- Camera input is video-only and processed locally. Model/runtime/code assets are
  bundled; Google Slides still requires internet. No analytics or video-upload
  code is included. Network privacy inspection remains a release check.
- School/organisation policy may block developer-mode installation. This beta
  is not Chrome Web Store approved and does not update automatically.

MediaPipe Tasks Vision and its hand landmarker model power tracking. React,
shadcn/ui and Base UI power the interface. Bundled software licenses are in
`THIRD_PARTY_NOTICES.txt`.
