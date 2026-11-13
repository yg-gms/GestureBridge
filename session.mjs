import { normalizePose } from './features.mjs';
import { LABELS } from './labels.mjs';
import { PoseRecorder } from './recording.mjs';
import { predictPose, acceptedLabel } from './classifier.mjs';
import { CALIBRATION_STEPS, CalibrationSession } from './calibration.mjs';
import { CommandGate } from './commands.mjs';

const names = { next: 'Next', previous: 'Previous', neutral: 'Neutral' };

export class GestureSession {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.onChange = () => {};
    this.recorder = new PoseRecorder();
    this.calibration = new CalibrationSession();
    this.gate = new CommandGate();
    this.step = 'teach';
    this.selectedLabel = 'next';
    this.camera = { running: false, loading: false, message: 'Camera off.' };
    this.hidden = false;
    this.handCount = 0;
    this.latestPose = null;
    this.prediction = null;
    this.paused = true;
    this.started = false;
    this.slideIndex = 0;
    this.message = 'Choose a comfortable Next pose. Record three short clips.';
  }

  get trained() {
    return LABELS.every((label) => this.recorder.clips[label] === 3);
  }
  get busy() {
    return !!(this.recorder.active || this.calibration.active);
  }
  get calibrated() {
    return Number.isFinite(this.calibration.result?.cutoff);
  }
  emit() {
    this.onChange(this.snapshot());
  }

  blockReason() {
    if (!this.camera.running)
      return 'Start the camera to enable gesture controls.';
    if (this.hidden) return 'Return to this tab, then resume.';
    if (this.busy) return 'Finish this capture first.';
    if (!this.trained) return 'Record three clips for each pose first.';
    if (!this.calibrated)
      return this.calibration.result
        ? 'Calibration failed. Restart calibration with more distinct poses.'
        : `Complete calibration (${this.calibration.captures.length}/5 captures).`;
    if (this.step !== 'present') return 'Open Present when you are ready.';
    return null;
  }

  snapshot() {
    const now = this.now();
    const cutoff = this.calibration.result?.cutoff ?? null;
    const label = acceptedLabel(this.prediction, cutoff);
    const active = this.recorder.active || this.calibration.active;
    const pending = this.gate.pending;
    const blocked = this.blockReason();
    const description = !this.latestPose
      ? 'Show one hand'
      : !this.trained
        ? 'Hand detected'
        : !this.calibrated
          ? 'Calibration needed'
          : label
            ? names[label]
            : this.prediction?.distance > cutoff
              ? 'Unfamiliar pose'
              : 'Uncertain pose';
    return {
      step: this.step,
      selectedLabel: this.selectedLabel,
      camera: { ...this.camera },
      hand: { count: this.handCount, ready: !!this.latestPose },
      clips: { ...this.recorder.clips },
      trained: this.trained,
      busy: this.busy,
      capture: active
        ? {
            kind: this.recorder.active ? 'training' : 'calibration',
            progress: Math.min(
              100,
              Math.max(
                0,
                (now - active.start) / (this.recorder.active ? 30 : 20),
              ),
            ),
          }
        : null,
      message: this.message,
      calibration: {
        count: this.calibration.captures.length,
        step: CALIBRATION_STEPS[this.calibration.captures.length] ?? null,
        result: this.calibration.result,
        ready: this.calibrated,
      },
      recognition: {
        label,
        description,
        votes: this.prediction?.votes ?? 0,
        distance: this.prediction?.distance ?? null,
        cutoff,
      },
      controls: {
        paused: this.paused,
        started: this.started,
        armed: this.gate.armed,
        enabled: blocked === null,
        progress: pending
          ? Math.min(
              100,
              (now - pending.since) / (pending.label === 'neutral' ? 4 : 5),
            )
          : 0,
        status: this.paused
          ? (blocked ?? 'Ready when you are. Start gesture controls.')
          : !this.latestPose
            ? 'Show one hand, then hold Neutral.'
            : !label
              ? 'Pose not recognised. Show a trained pose.'
              : !this.gate.armed
                ? 'Hold Neutral to get ready.'
                : pending
                  ? `Hold to go ${pending.label}.`
                  : 'Ready. Show Next or Previous.',
      },
      slideIndex: this.slideIndex,
    };
  }

  goToStep(step) {
    if (
      this.busy ||
      !['teach', 'calibrate', 'present'].includes(step) ||
      (step === 'calibrate' && !this.trained) ||
      (step === 'present' && !this.calibrated)
    )
      return false;
    this.paused = true;
    this.gate.reset();
    this.step = step;
    this.emit();
    return true;
  }

  selectLabel(label) {
    if (!LABELS.includes(label) || !this.goToStep('teach')) return false;
    this.selectedLabel = label;
    this.message = `Show your ${names[label]} pose. Relax and reposition between clips.`;
    this.emit();
    return true;
  }

  record() {
    if (
      this.step !== 'teach' ||
      !this.camera.running ||
      this.hidden ||
      !this.latestPose ||
      this.busy ||
      !this.recorder.start(this.selectedLabel, this.now())
    )
      return false;
    this.calibration.reset();
    this.paused = true;
    this.gate.reset();
    this.message = `Hold your ${names[this.selectedLabel]} pose for 3 seconds.`;
    this.emit();
    return true;
  }

  resetLabel(label) {
    if (!LABELS.includes(label) || this.busy) return false;
    this.recorder.reset(label);
    this.calibration.reset();
    this.selectedLabel = label;
    this.step = 'teach';
    this.paused = true;
    this.gate.reset();
    this.prediction = null;
    this.message = `${names[label]} cleared. Record three fresh clips, then recalibrate.`;
    this.emit();
    return true;
  }

  captureCalibration() {
    if (
      this.step !== 'calibrate' ||
      !this.trained ||
      !this.camera.running ||
      this.hidden ||
      !this.latestPose ||
      this.busy ||
      !this.calibration.start(this.now())
    )
      return false;
    this.paused = true;
    this.gate.reset();
    this.message = 'Hold this pose steady for 2 seconds.';
    this.emit();
    return true;
  }

  restartCalibration() {
    if (this.busy || !this.trained) return false;
    this.calibration.reset();
    this.paused = true;
    this.gate.reset();
    this.step = 'calibrate';
    this.message = 'Start with a fresh capture of your Next pose.';
    this.emit();
    return true;
  }

  toggleControls() {
    if (!this.paused) {
      this.pause();
      return true;
    }
    if (this.blockReason()) return false;
    this.gate.reset();
    this.paused = false;
    this.started = true;
    this.emit();
    return true;
  }

  pause() {
    this.paused = true;
    this.gate.reset();
    this.emit();
  }

  changeSlide(direction) {
    if (!['next', 'previous'].includes(direction)) return;
    this.gate.reset();
    this.slideIndex = Math.max(
      0,
      Math.min(5, this.slideIndex + (direction === 'next' ? 1 : -1)),
    );
    this.emit();
  }

  interrupt(message = 'Tracking interrupted.') {
    if (this.busy)
      this.message = `${message} Incomplete capture discarded; retry this step.`;
    this.recorder.cancel();
    this.calibration.cancel();
    this.gate.reset();
    this.latestPose = null;
    this.prediction = null;
    this.handCount = 0;
    this.emit();
  }

  setHidden(hidden) {
    this.hidden = hidden;
    if (hidden) {
      this.paused = true;
      this.interrupt('Tab hidden.');
    } else this.emit();
  }

  setCameraState(state) {
    this.camera = { ...this.camera, ...state };
    if (!this.camera.running) {
      this.paused = true;
      this.interrupt('Camera stopped.');
    } else this.emit();
  }

  track(landmarks, width, height, now = this.now()) {
    if (!this.camera.running || this.hidden) return;
    this.handCount = landmarks.length;
    this.latestPose =
      landmarks.length === 1
        ? normalizePose(landmarks[0], width, height)
        : null;
    if (!this.latestPose) {
      this.interrupt('Tracking interrupted.');
      this.handCount = landmarks.length;
      this.emit();
      return;
    }
    if (this.recorder.active) {
      const label = this.recorder.active.label;
      const before = this.recorder.clips[label];
      const outcome = this.recorder.add(this.latestPose, now);
      if (!this.recorder.active) {
        if (this.recorder.clips[label] > before) {
          const cleanup = outcome.removed
            ? ` Ignored ${outcome.removed} unusual sample${outcome.removed === 1 ? '' : 's'}.`
            : '';
          this.message = `Clip saved.${cleanup} Relax and reposition before the next clip.`;
          if (this.recorder.clips[label] === 3)
            this.selectedLabel =
              LABELS.find((item) => this.recorder.clips[item] < 3) ?? label;
          if (this.trained) {
            this.step = 'calibrate';
            this.message = `Poses recorded.${cleanup} Now check them with fresh captures.`;
          }
        } else
          this.message =
            outcome?.reason === 'unstable'
              ? 'Your pose changed too much. Keep it steady and record this clip again.'
              : 'Not enough usable samples. Please retry this clip.';
      }
    } else if (this.calibration.active) {
      const outcome = this.calibration.add(
        this.latestPose,
        this.recorder.examples,
        now,
      );
      if (outcome === 'complete') {
        this.step = 'present';
        this.message =
          'Calibration passed. Try your poses, then start gesture controls.';
      } else if (outcome === 'failed') {
        this.message =
          this.calibration.result.reason === 'known-poses'
            ? 'A trained pose was not recognised consistently. Retry calibration or re-record clearer poses.'
            : 'Known and unrelated poses overlap. Use more distinct poses, then restart calibration.';
      } else if (outcome === 'retry')
        this.message = 'Not enough fresh samples. Retry this capture.';
      else if (outcome === 'saved')
        this.message = 'Capture saved. Prepare the next pose.';
    }
    this.prediction =
      this.trained && !this.busy
        ? predictPose(this.latestPose, this.recorder.examples)
        : null;
    if (!this.paused && !this.blockReason()) {
      const command = this.gate.update(
        acceptedLabel(this.prediction, this.calibration.result.cutoff),
        now,
      );
      if (command)
        this.slideIndex = Math.max(
          0,
          Math.min(5, this.slideIndex + (command === 'next' ? 1 : -1)),
        );
    } else this.gate.reset();
    this.emit();
  }
}
