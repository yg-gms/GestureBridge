import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

console.log("MediaPipe imported successfully");


const startButton = document.getElementById("start-camera");
const statusText = document.getElementById("status");
const video = document.getElementById("camera-preview");
const stopButton = document.getElementById("stop-camera");

let handLandmarker = null;

async function loadHandModel() {
  const base = import.meta.env.BASE_URL;

  const vision = await FilesetResolver.forVisionTasks(
    `${base}mediapipe/wasm`
  );

  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `${base}mediapipe/hand_landmarker.task`,
    },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

async function handleStartClick() {
  startButton.disabled = true;

  try {
    if (!handLandmarker) {
      statusText.textContent = "Loading hand tracker...";
      handLandmarker = await loadHandModel();
    }

    statusText.textContent = "Requesting camera access...";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    video.srcObject = stream;
    stopButton.disabled = false;
    statusText.textContent = "Camera and hand tracker are ready.";
  } catch (error) {
    console.error(error);
    statusText.textContent =
      "Could not start the camera or hand tracker. Please try again.";
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