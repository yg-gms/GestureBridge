# GestureBridge

Learn custom hand poses to control the built-in six-slide presentation demo.

Run `npm install` once, then `npm run dev` and open the local URL. Run `npm test`
for automated checks and `npm run build` for the production bundle.

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

Examples and calibration stay in page memory; reload clears them. This prototype
controls its own viewer. Unfamiliar poses can still resemble recorded ones.
