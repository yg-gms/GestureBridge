# GestureBridge

Learn custom hand poses to control the built-in six-slide presentation demo.

Run `npm install` once, then `npm run dev` and open the local URL. Run `npm test`
for automated checks and `npm run build` for the production bundle.

1. Start the camera and record three clips each for Next, Previous and Neutral.
2. Complete the five fresh calibration captures, then check recognition.
3. Click **Start gesture controls**. Hold Neutral for 400 ms to get ready.
4. Hold Next or Previous for 500 ms to change one slide. Hold Neutral again before
   another command; holding a command continuously never repeats it.
5. Use **Pause gesture controls** or Escape to pause. Hiding the tab or stopping
   the camera also pauses controls. Starting or resuming requires Neutral again.

Only one visible hand is accepted. Uncertainty, a changed pose, tracking loss,
or a frame gap over 300 ms cancels a pending hold. Manual slide buttons work
independently of gesture controls.

Examples and calibration stay in page memory; reload clears them. This prototype
controls its own viewer. Unfamiliar poses can still resemble recorded ones.
