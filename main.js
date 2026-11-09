const startButton = document.getElementById("start-camera");
const statusText = document.getElementById("status");
const video = document.getElementById("camera-preview");
const stopButton = document.getElementById("stop-camera");

async function handleStartClick() {
  startButton.disabled = true;
  statusText.textContent = "Requesting camera access...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    video.srcObject = stream;
    stopButton.disabled = false;
    statusText.textContent = "Camera is on.";
  } catch (error) {
    console.error(error);
    statusText.textContent =
      "Camera unavailable. Check browser permissions and try again.";
    startButton.disabled = false;
  }
}

startButton.addEventListener("click", handleStartClick);

function handleStopClick() {
  const stream = video.srcObject;

  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  video.srcObject = null;
  startButton.disabled = false;
  stopButton.disabled = true;
  statusText.textContent = "Camera is off.";
}

stopButton.addEventListener("click", handleStopClick);