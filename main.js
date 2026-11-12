import { normalizePose } from "./features.mjs";
import { LABELS, PoseRecorder } from "./recording.mjs";
import { euclideanDistance, predictPose, acceptedLabel } from "./classifier.mjs";
import { CALIBRATION_STEPS, CalibrationSession } from "./calibration.mjs";
import { CommandGate } from "./commands.mjs";
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
const calibration = new CalibrationSession();
const recordingStatus = document.getElementById("recording-status");
const featuresStatus = document.getElementById("features-status");
const recordingControls = document.getElementById("recording-controls");
const recognitionStatus = document.getElementById("recognition-status");
const calibrationButton = document.getElementById("capture-calibration");
const resetCalibrationButton = document.getElementById("reset-calibration");
const calibrationStatus = document.getElementById("calibration-status");
const calibrationInstruction = document.getElementById("calibration-instruction");
const commandGate = new CommandGate();
const toggleControlsButton = document.getElementById("toggle-controls");
const commandStatus = document.getElementById("command-status");
const holdProgress = document.getElementById("hold-progress");
const slides = [...document.querySelectorAll("#slide-viewer article")];
const slidePosition = document.getElementById("slide-position");
const previousSlideButton = document.getElementById("previous-slide");
const nextSlideButton = document.getElementById("next-slide");
let slideIndex = 0;
let controlsPaused = true;
let controlsStarted = false;
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
    if (calibration.active) return;
    if (recorder.start(label, performance.now())) {
      resetCalibration();
      recordingStatus.textContent = `Recording ${labelNames[label]}: hold your pose for 3 seconds.`;
      renderRecording();
    }
  });
  reset.addEventListener("click", () => {
    recorder.reset(label);
    resetCalibration();
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
    record.disabled = !latestPose || !video.srcObject || document.hidden || !!recorder.active || !!calibration.active || recorder.clips[label] >= 3;
    reset.disabled = !!recorder.active || !!calibration.active || recorder.clips[label] === 0;
  }
  const step = CALIBRATION_STEPS[calibration.captures.length];
  const trained = LABELS.every(label => recorder.clips[label] === 3);
  calibrationButton.disabled = !trained || !latestPose || !video.srcObject || document.hidden ||
    !!recorder.active || !!calibration.active || !!calibration.result;
  calibrationButton.textContent = step ? `Capture ${step.name} (2 seconds)` : "Calibration finished";
  resetCalibrationButton.disabled = calibration.captures.length === 0 && !calibration.active;
  calibrationInstruction.textContent = !trained ? "Record all three poses first." : step
    ? `Step ${calibration.captures.length + 1}/5: ${step.instruction} Hold it steady before clicking Capture.`
    : calibration.result?.cutoff !== null ? "Try your trained poses and some unrelated poses below."
    : "Retry calibration, or clear and re-record poses that are easier to distinguish.";
  renderCommands();
  return renderRecognition();
}

function resetCalibration() {
  pauseControls();
  calibration.reset();
  calibrationStatus.textContent = "Calibration needed. Training changes clear the previous calibration.";
}

calibrationButton.addEventListener("click", () => {
  if (!latestPose || !video.srcObject || document.hidden || recorder.active ||
      !LABELS.every(label => recorder.clips[label] === 3)) return;
  if (calibration.start(performance.now())) {
    pauseControls();
    calibrationStatus.textContent = "Capturing: hold your pose for 2 seconds.";
    renderRecording();
  }
});
resetCalibrationButton.addEventListener("click", () => {
  resetCalibration();
  renderRecording();
});

function renderRecognition() {
  if (euclideanDistance([0], [0]) === null) {
    recognitionStatus.textContent = "Complete euclideanDistance in classifier.mjs to compare poses.";
  } else if (!LABELS.every(label => recorder.clips[label] === 3)) {
    recognitionStatus.textContent = "Record three clips for each pose to start comparing.";
  } else if (recorder.active || calibration.active) {
    recognitionStatus.textContent = "Comparison paused while recording.";
  } else if (!latestPose || document.hidden || !video.srcObject) {
    recognitionStatus.textContent = "Show one hand to compare it with your examples.";
  } else {
    const prediction = predictPose(latestPose, recorder.examples);
    const cutoff = calibration.result?.cutoff ?? null;
    if (!prediction) {
      recognitionStatus.textContent = "Could not compare this pose. Check the distance calculation.";
    } else if (cutoff === null) {
      recognitionStatus.textContent = "Calibrate before accepting poses. " +
        `${prediction.votes}/5 neighbours agree; average distance ${prediction.distance.toFixed(2)}.`;
    } else {
      const label = acceptedLabel(prediction, cutoff);
      const description = label ? `Recognised: ${labelNames[label]}`
        : prediction.distance > cutoff ? "Unfamiliar pose" : "Uncertain pose";
      recognitionStatus.textContent = `${description}. ${prediction.votes}/5 neighbours agree; ` +
        `distance ${prediction.distance.toFixed(2)}, cutoff ${cutoff.toFixed(2)}.`;
      return label;
    }
  }
  return null;
}

function canControl() {
  return controlsBlockReason() === null;
}

function controlsBlockReason() {
  if (!video.srcObject) return "Please start the camera to enable gesture controls.";
  if (document.hidden) return "Return to this tab, then resume gesture controls.";
  if (recorder.active) return "Finish recording this clip before starting gesture controls.";
  if (calibration.active) return "Finish this calibration capture before starting gesture controls.";
  if (!Number.isFinite(calibration.result?.cutoff)) {
    if (!LABELS.every(label => recorder.clips[label] === 3)) {
      return "Record three clips each for Next, Previous and Neutral, then calibrate.";
    }
    if (calibration.result) return "Calibration failed. Use Restart calibration above; check its failure message before retrying.";
    return `Complete calibration above (${calibration.captures.length}/5 captures saved) to enable gesture controls.`;
  }
  return null;
}

function renderCommands(now = performance.now()) {
  const blocked = controlsBlockReason();
  toggleControlsButton.disabled = blocked !== null;
  toggleControlsButton.textContent = !controlsPaused ? "Pause gesture controls"
    : controlsStarted ? "Resume gesture controls" : "Start gesture controls";
  const pending = commandGate.pending;
  holdProgress.value = pending ? Math.min(1, (now - pending.since) / (pending.label === "neutral" ? 400 : 500)) : 0;
  commandStatus.textContent = controlsPaused
    ? blocked ?? "Paused. Start or resume when ready."
    : !latestPose ? "Show one hand. Hold Neutral to get ready."
    : pending?.label === "neutral" ? "Hold Neutral to get ready."
    : !commandGate.armed ? "Hold Neutral to get ready."
    : pending ? `Hold to go ${pending.label}.`
    : "Ready. Hold Next or Previous to change one slide.";
}

function pauseControls() {
  controlsPaused = true;
  commandGate.reset();
  renderCommands();
}

toggleControlsButton.addEventListener("click", () => {
  if (!controlsPaused) return pauseControls();
  if (!canControl()) return;
  commandGate.reset();
  controlsPaused = false;
  controlsStarted = true;
  renderCommands();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") pauseControls();
});

function changeSlide(direction) {
  slideIndex = Math.max(0, Math.min(slides.length - 1, slideIndex + (direction === "next" ? 1 : -1)));
  slides.forEach((slide, index) => { slide.hidden = index !== slideIndex; });
  slidePosition.textContent = `Slide ${slideIndex + 1} of ${slides.length}`;
  previousSlideButton.disabled = slideIndex === 0;
  nextSlideButton.disabled = slideIndex === slides.length - 1;
}
previousSlideButton.addEventListener("click", () => {
  commandGate.reset();
  changeSlide("previous");
  renderCommands();
});
nextSlideButton.addEventListener("click", () => {
  commandGate.reset();
  changeSlide("next");
  renderCommands();
});

function cancelRecording(message) {
  commandGate.reset();
  if (recorder.active) recordingStatus.textContent = `${message} Incomplete clip discarded; record it again.`;
  recorder.cancel();
  if (calibration.active) {
    calibration.cancel();
    calibrationStatus.textContent = `${message} Incomplete calibration capture discarded; retry this step.`;
  }
  latestPose = null;
  renderRecording();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseControls();
    cancelRecording("Tab hidden.");
  }
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
      } else if (calibration.active) {
        const now = performance.now();
        const remaining = Math.max(0, 2 - (now - calibration.active.start) / 1000);
        const outcome = calibration.add(latestPose, recorder.examples, now);
        if (outcome === "complete") {
          calibrationStatus.textContent = "Calibrated. Fresh known and unrelated samples were separated. Try your poses below.";
        } else if (outcome === "failed") {
          calibrationStatus.textContent = calibration.result.reason === "known-poses"
            ? "A trained pose was not recognised consistently. Retry while holding steady, or re-record clearer poses."
            : "Known and unrelated poses overlap. Use more distinct training poses or unrelated poses, then retry.";
        } else if (outcome === "retry") {
          calibrationStatus.textContent = "Not enough fresh samples. Retry this calibration step.";
        } else if (outcome === "saved") {
          calibrationStatus.textContent = "Capture saved. Relax, then prepare the next pose.";
        } else {
          calibrationStatus.textContent = `Capturing: ${remaining.toFixed(1)} seconds left.`;
        }
      }
      const label = renderRecording();
      if (!controlsPaused && canControl()) {
        const command = commandGate.update(label, performance.now());
        if (command) changeSlide(command);
      } else {
        commandGate.reset();
      }
      renderCommands();

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
    pauseControls();
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
    renderRecording();
}

stopButton.addEventListener("click", handleStopClick);
