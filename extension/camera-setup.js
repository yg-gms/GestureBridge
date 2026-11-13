import '../src/styles.css';
import './workspace.css';

const button = document.getElementById('enable');
const status = document.getElementById('status');
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    for (const track of stream.getTracks()) track.stop();
    status.textContent =
      'Camera permission granted. Close this tab, return to Slides, and press Start camera check in the panel.';
  } catch {
    status.textContent =
      'Camera access was not allowed. In Chrome, open Extensions → GestureBridge → Details → Site settings and allow Camera, then try again. Also check macOS camera access for Chrome.';
    button.disabled = false;
  }
});
