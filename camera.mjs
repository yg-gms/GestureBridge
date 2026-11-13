import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

async function loadHandModel() {
  const base = import.meta.env.BASE_URL;
  const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `${base}mediapipe/hand_landmarker.task` },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

export function createCamera({
  video,
  canvas,
  session,
  loadModel = loadHandModel,
  getUserMedia = (constraints) =>
    navigator.mediaDevices.getUserMedia(constraints),
}) {
  const context = canvas.getContext('2d');
  let model = null;
  let modelRequest = null;
  let timer = null;
  let generation = 0;
  let loading = false;
  let disposed = false;
  let lastVideoTime = -1;

  function stop() {
    generation++;
    loading = false;
    clearTimeout(timer);
    for (const track of video.srcObject?.getTracks() ?? []) track.stop();
    video.srcObject = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    session.setCameraState({
      running: false,
      loading: false,
      message: 'Camera off.',
    });
  }

  function detect() {
    if (!video.srcObject || disposed) return;
    try {
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const result = model.detectForVideo(video, performance.now());
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.fillStyle = '#a78bfa';
        if (result.landmarks.length === 1) {
          for (const point of result.landmarks[0]) {
            context.beginPath();
            context.arc(
              point.x * canvas.width,
              point.y * canvas.height,
              4,
              0,
              Math.PI * 2,
            );
            context.fill();
          }
        }
        session.track(result.landmarks, video.videoWidth, video.videoHeight);
      }
    } catch {
      stop();
      session.setCameraState({
        message: 'Hand tracking failed. Restart the camera to try again.',
      });
      return;
    }
    timer = setTimeout(detect, 100);
  }

  async function start() {
    if (disposed || loading || video.srcObject) return false;
    const request = ++generation;
    loading = true;
    session.setCameraState({
      running: false,
      loading: true,
      message: 'Loading hand tracker…',
    });
    try {
      if (!model) {
        modelRequest ??= loadModel().then(
          (loaded) => {
            if (disposed) {
              loaded.close();
              return;
            }
            model = loaded;
          },
          (error) => {
            modelRequest = null;
            throw error;
          },
        );
        await modelRequest;
      }
      if (request !== generation) return false;
      session.setCameraState({ message: 'Allow camera access to continue.' });
      const stream = await getUserMedia({ video: true, audio: false });
      if (request !== generation) {
        for (const track of stream.getTracks()) track.stop();
        return false;
      }
      video.srcObject = stream;
      await video.play();
      if (request !== generation) return false;
      for (const track of stream.getVideoTracks()) {
        track.addEventListener(
          'ended',
          () => {
            if (video.srcObject === stream) stop();
          },
          { once: true },
        );
      }
      loading = false;
      lastVideoTime = -1;
      session.setCameraState({
        running: true,
        loading: false,
        message: 'Camera ready.',
      });
      detect();
      return true;
    } catch (error) {
      if (request !== generation) return false;
      stop();
      session.setCameraState({
        message:
          error.name === 'NotAllowedError'
            ? 'Camera access denied. Allow it in your browser, then try again.'
            : 'Could not start the camera or hand tracker. Please try again.',
      });
      return false;
    }
  }

  function dispose() {
    disposed = true;
    stop();
    model?.close();
    model = null;
  }

  return { start, stop, dispose };
}
