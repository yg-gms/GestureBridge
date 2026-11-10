import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

console.log("MediaPipe imported successfully");


const startButton = document.getElementById("start-camera");
const statusText = document.getElementById("status");
const video = document.getElementById("camera-preview");
const stopButton = document.getElementById("stop-camera");
const canvas = document.getElementById("hand-overlay");
const context = canvas.getContext("2d");

function drawLandmarks(landmarks) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.fillStyle = "#00ff88";

  for (const point of landmarks) {
    context.beginPath();
    context.arc(
      point.x * canvas.width,
      point.y * canvas.height,
      4,
      0,
      Math.PI * 2
    );
    context.fill();
  }
}

let handLandmarker = null;

let detectionTimer = null;
let lastVideoTime = -1;

function detectHands() {
  if (!video.srcObject) return;

  try {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      const result = handLandmarker.detectForVideo(video, performance.now());
      const handCount = result.landmarks.length;

      drawLandmarks(handCount === 1 ? result.landmarks[0] : []);

      statusText.textContent =
        handCount === 0 ? "No hand detected." :
        handCount === 1 ? "One hand detected." :
        "Show only one hand.";
    }
  } catch (error) {
    console.error(error);
    handleStopClick();
    statusText.textContent = "Hand tracking failed. Please try again.";
    return;
  }

  detectionTimer = setTimeout(detectHands, 100);
}

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
    await video.play();

    lastVideoTime = -1;
    detectHands();

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

    clearTimeout(detectionTimer);
    context.clearRect(0, 0, canvas.width, canvas.height);
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