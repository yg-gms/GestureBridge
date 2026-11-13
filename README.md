# GestureBridge

Learn custom hand poses to control the built-in six-slide presentation demo.

Run `npm install` once, then `npm run dev` and open the local URL. Run `npm test`
for automated checks and `npm run build` for the production bundle.
Use `npm run format` to format the project and `npm run format:check` to check it.

1. In **Teach**, start the camera and record three clips for each pose. The app
   guides Next, Previous and Neutral one at a time, then opens calibration.
2. In **Calibrate**, complete five fresh captures. Overlap failures stay on this
   step with a retry message; successful calibration opens the presentation.
3. In **Present**, click **Start controls**. Hold Neutral for 400 ms to get ready.
4. Hold Next or Previous for 500 ms to change one slide. Hold Neutral again before
   another command; holding a command continuously never repeats it.
5. Use **Pause controls** or Escape to pause. Hiding the tab or stopping
   the camera also pauses controls. Starting or resuming requires Neutral again.

Only one visible hand is accepted. Uncertainty, a changed pose, tracking loss,
or a frame gap over 300 ms cancels a pending hold. Manual slide buttons work
independently of gesture controls.

The camera stays visible beside the current task on desktop. **Help & diagnostics**
contains the longer instructions and numerical details. Return to **Teach** to
retake one pose; this preserves the others and requires fresh calibration.

The interface uses React and shadcn/ui with Base UI. The normalization, recording,
classifier, calibration and command gate remain separate JavaScript modules.

Sideways hand tilt is normalized using the direction from the wrist to the middle
knuckle. Choose different finger shapes for your commands; angle alone will not
distinguish them. Turning your palm toward or away from the camera can still
change its visible shape. Refresh, re-record and recalibrate after a change to
normalization.

Recording now checks each clip before saving it. It keeps the consistent samples
and reports how many unusual samples were ignored. If fewer than 12 of the 15
samples remain, it asks you to record that clip again and keeps earlier clips.
The filter uses a representative recorded pose and median-based spread; its
initial settings still need physical testing. A consistently wrong pose cannot
be identified from recording consistency alone.

See the [project guide](docs/README.md) for the file map and filtering details.

For the Google Slides extension beta, run `npm run build:extension`.
Load `dist-extension/` through Chrome's **Load unpacked** action or unzip
`releases/gesturebridge-slides-0.2.0.zip` and load that folder. Follow the
[setup and acceptance check](extension/README.md). Teach poses, calibrate, and
connect the real Slides deck. The extension saves one set of poses locally;
reopening requires fresh calibration and explicit start. Keep its panel visible.

The public web demo keeps examples/calibration in memory and controls its own
viewer; reloading clears that demo session. Unfamiliar poses can still resemble
recorded ones in either version.
