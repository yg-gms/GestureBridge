import { normalizePose } from "./features.mjs";
import { LABELS, PoseRecorder } from "./recording.mjs";
import { euclideanDistance, predictPose } from "./classifier.mjs";
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

const recorder = new PoseRecorder();
const recordingStatus = document.getElementById("recording-status");
const featuresStatus = document.getElementById("features-status");
const recordingControls = document.getElementById("recording-controls");
const recognitionStatus = document.getElementById("recognition-status");
let latestPose = null;
const labelNames = { next: "Next", previous: "Previous", neutral: "Neutral" };
const recordRows = LABELS.map(label => {
  const row = document.createElement("p");
  const count = document.createElement("span");
  const record = document.createElement("button");
  const reset = document.createElement("button");
  record.type = reset.type = "button";
  record.textContent = `Record ${labelNames[label]} (3 seconds)`;
  reset.textContent = `Clear ${labelNames[label]}`;
  record.addEventListener("click", () => {
    if (!latestPose || !video.srcObject || document.hidden) return;
    if (recorder.start(label, performance.now())) {
      recordingStatus.textContent = `Recording ${labelNames[label]}: hold your pose for 3 seconds.`;
      renderRecording();
    }
  });
  reset.addEventListener("click", () => {
    recorder.reset(label);
    recordingStatus.textContent = `${labelNames[label]} examples cleared.`;
    renderRecording();
  });
  row.append(count, " ", record, " ", reset);
  recordingControls.append(row);
  return { label, count, record, reset };
});

function renderRecording() {
  for (const { label, count, record, reset } of recordRows) {
    count.textContent = `${labelNames[label]}: ${recorder.clips[label]}/3 clips, ${recorder.clips[label] * 15} examples.`;
    record.disabled = !latestPose || !video.srcObject || document.hidden || !!recorder.active || recorder.clips[label] >= 3;
    reset.disabled = !!recorder.active || recorder.clips[label] === 0;
  }
  renderRecognition();
}

function renderRecognition() {
  if (euclideanDistance([0], [0]) === null) {
    recognitionStatus.textContent = "Complete euclideanDistance in classifier.mjs to compare poses.";
  } else if (!LABELS.every(label => recorder.clips[label] === 3)) {
    recognitionStatus.textContent = "Record three clips for each pose to start comparing.";
  } else if (recorder.active) {
    recognitionStatus.textContent = "Comparison paused while recording.";
  } else if (!latestPose || document.hidden || !video.srcObject) {
    recognitionStatus.textContent = "Show one hand to compare it with your examples.";
  } else {
    const prediction = predictPose(latestPose, recorder.examples);
    recognitionStatus.textContent = !prediction
      ? "Could not compare this pose. Check the distance calculation."
      : `${prediction.label ? `Closest recorded pose: ${labelNames[prediction.label]}` : "Uncertain pose"}. ` +
        `${prediction.votes}/5 neighbours agree; average distance ${prediction.distance.toFixed(2)}. ` +
        "Uncalibrated: unfamiliar poses may still get a label.";
  }
}

function cancelRecording(message) {
  if (recorder.active) recordingStatus.textContent = `${message} Incomplete clip discarded; record it again.`;
  recorder.cancel();
  latestPose = null;
  renderRecording();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelRecording("Tab hidden.");
});
renderRecording();

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
      latestPose = handCount === 1
        ? normalizePose(result.landmarks[0], video.videoWidth, video.videoHeight)
        : null;
      featuresStatus.textContent = latestPose
        ? "Pose vector ready: 42 numbers. You can record examples."
        : handCount === 1
          ? "Normalization not ready: complete normalizeCoordinates in features.mjs."
          : "Show one hand to prepare a pose vector.";
      if (!latestPose || document.hidden) {
        cancelRecording("Tracking interrupted.");
      } else if (recorder.active) {
        const label = recorder.active.label;
        const before = recorder.clips[label];
        const remaining = Math.max(0, 3 - (performance.now() - recorder.active.start) / 1000);
        recorder.add(latestPose, performance.now());
        recordingStatus.textContent = recorder.active
          ? `Recording ${labelNames[label]}: ${remaining.toFixed(1)} seconds left.`
          : recorder.clips[label] > before
            ? `Saved ${labelNames[label]} clip. Relax and reposition before the next clip.`
            : "Not enough fresh samples. Please record the clip again.";
      }
      renderRecording();

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
    for (const track of stream.getVideoTracks()) {
      track.addEventListener("ended", handleStopClick, { once: true });
    }

    lastVideoTime = -1;
    detectHands();

    stopButton.disabled = false;
    statusText.textContent = "Camera and hand tracker are ready.";
  } catch (error) {
    console.error(error);
    handleStopClick();
    statusText.textContent =
      "Could not start the camera or hand tracker. Please try again.";
    startButton.disabled = false;
  }
}

startButton.addEventListener("click", handleStartClick);

function handleStopClick() {
    cancelRecording("Camera stopped.");

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
