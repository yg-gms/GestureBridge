import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Hand, Info, LockKeyhole, Pause, Play, RotateCcw, ScanLine, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import './workspace.css';

const labels = { next: 'Next', previous: 'Previous', neutral: 'Neutral' };
const poseIcons = { next: ArrowRight, previous: ArrowLeft, neutral: Hand };
const slides = [
  ['GestureBridge', 'Your hand poses, your presentation controls.'],
  ['Teach your poses', 'Choose distinct Next, Previous and Neutral poses that are comfortable for you.'],
  ['Compare with your examples', 'The hand tracker finds landmarks. GestureBridge compares their shape with your recorded examples.'],
  ['Calibrate with fresh poses', 'Separate captures help reject poses that are too far from your examples.'],
  ['Hold, then rest', 'Hold a command to change one slide. Hold Neutral to prepare the next command.'],
  ["Try another person’s poses", 'Pause, clear the examples, and teach a new set. Unfamiliar poses may still resemble trained ones.'],
];

function CaptureProgress({ capture }) {
  return capture && <div className="capture-progress">
    <div className="meta-row"><span>Hold steady</span><span>{capture.kind === 'training' ? '3-second clip' : '2-second capture'}</span></div>
    <Progress value={capture.progress} aria-label="Capture progress" aria-live="off" />
  </div>;
}

function Teach({ session, view }) {
  const label = view.selectedLabel;
  const count = view.clips[label];
  const Icon = poseIcons[label];
  return <Card className="task-card">
    <CardHeader>
      <p className="eyebrow">01 / TEACH</p>
      <CardTitle>Make a pose your own.</CardTitle>
      <CardDescription>Choose a distinct, comfortable pose for each command.</CardDescription>
    </CardHeader>
    <CardContent className="task-content">
      <ToggleGroup value={[label]} onValueChange={value => value[0] && session.selectLabel(value[0])} disabled={view.busy} variant="outline" className="pose-selector" aria-label="Pose to teach">
        {Object.entries(labels).map(([key, name]) => <ToggleGroupItem key={key} value={key} aria-label={`${name}, ${view.clips[key]} of 3 clips`}>
          {name}<span className="tabular-nums">{view.clips[key]}/3</span>
        </ToggleGroupItem>)}
      </ToggleGroup>
      <div className="pose-focus">
        <div className="pose-symbol" aria-hidden="true"><Icon /></div>
        <div><p className="eyebrow">YOUR {labels[label].toUpperCase()} POSE</p><h2>{count === 3 ? 'Three clips. All set.' : `Hold your ${labels[label]} pose.`}</h2>
          <p className="quiet">{count === 3 ? 'You can retake this pose at any time.' : `Clip ${count + 1} of 3 · hold for 3 seconds`}</p></div>
      </div>
      <div className="clip-row" aria-label={`${count} of 3 clips saved`}>
        {[0, 1, 2].map(index => <div key={index} className={cn('clip-slot', index < count && 'is-saved')}>
          {index < count ? <Check aria-hidden="true" /> : <span>{String(index + 1).padStart(2, '0')}</span>}<span>Clip {index + 1}</span>
        </div>)}
      </div>
      <CaptureProgress capture={view.capture} />
      <p className="task-message" role="status">{view.busy ? 'Recording — keep one hand visible.' : view.message || 'Relax and slightly reposition your hand between clips.'}</p>
    </CardContent>
    <CardFooter className="task-actions">
      {count < 3 ? <Button size="lg" onClick={() => session.record()} disabled={!view.camera.running || !view.hand.ready || view.busy}>
        <ScanLine data-icon="inline-start" />{view.busy ? 'Recording…' : 'Record clip'}
      </Button> : <Button size="lg" onClick={() => session.goToStep('calibrate')} disabled={!view.trained || view.busy}>
        Calibrate<ArrowRight data-icon="inline-end" />
      </Button>}
      <Button variant="ghost" size="sm" disabled={view.busy || count === 0} onClick={() => session.resetLabel(label)}><RotateCcw data-icon="inline-start" />Retake {labels[label]}</Button>
    </CardFooter>
  </Card>;
}

function Calibrate({ session, view }) {
  const { calibration } = view;
  const failed = calibration.result && !calibration.ready;
  return <Card className="task-card">
    <CardHeader>
      <p className="eyebrow">02 / CALIBRATE</p>
      <CardTitle>A quick reality check.</CardTitle>
      <CardDescription>Five fresh captures help distinguish your poses.</CardDescription>
      <CardAction><Badge variant="secondary">{calibration.count} / 5</Badge></CardAction>
    </CardHeader>
    <CardContent className="task-content">
      <ol className="calibration-steps" aria-label="Calibration captures">
        {['Next', 'Previous', 'Neutral', 'Other 1', 'Other 2'].map((name, index) => <li key={name} className={cn(index < calibration.count && 'is-saved', index === calibration.count && 'is-current')}>
          <span>{index < calibration.count ? <Check aria-hidden="true" /> : index + 1}</span><small>{name}</small>
        </li>)}
      </ol>
      <div className="pose-focus">
        <div className="pose-symbol" aria-hidden="true">{calibration.ready ? <Check /> : <ScanLine />}</div>
        <div><p className="eyebrow">{calibration.step ? `CAPTURE ${calibration.count + 1} OF 5` : 'CALIBRATION RESULT'}</p>
          <h2>{calibration.ready ? 'Ready to present.' : failed ? 'Let’s try that again.' : calibration.step?.name}</h2>
          <p className="quiet">{calibration.ready ? 'Start gesture controls when you’re ready.' : calibration.step?.instruction || 'Use more distinct poses, then retry.'}</p></div>
      </div>
      <CaptureProgress capture={view.capture} />
      {failed ? <Alert variant="destructive"><Info /><AlertTitle>Calibration needs another try</AlertTitle><AlertDescription>{view.message}</AlertDescription></Alert>
        : <p className="task-message" role="status">{view.busy ? 'Capturing — keep your pose steady.' : view.message || 'Hold the pose steady before starting each capture.'}</p>}
    </CardContent>
    <CardFooter className="task-actions">
      {calibration.ready ? <Button size="lg" onClick={() => session.goToStep('present')}>Open presentation<ArrowRight data-icon="inline-end" /></Button>
        : <Button size="lg" onClick={() => session.captureCalibration()} disabled={!view.trained || !view.camera.running || !view.hand.ready || view.busy || !!calibration.result}>
          <ScanLine data-icon="inline-start" />{view.busy ? 'Capturing…' : 'Capture · 2 seconds'}
        </Button>}
      <Button variant="ghost" size="sm" onClick={() => session.restartCalibration()} disabled={view.busy || calibration.count === 0}><RotateCcw data-icon="inline-start" />Restart</Button>
    </CardFooter>
  </Card>;
}

function Present({ session, view }) {
  const [title, body] = slides[view.slideIndex];
  const { controls } = view;
  return <Card className="task-card presentation-card">
    <CardHeader>
      <p className="eyebrow">03 / PRESENT</p>
      <CardTitle>Your hands take it from here.</CardTitle>
      <CardDescription>Neutral to get ready. Next or Previous to move.</CardDescription>
      <CardAction><Badge variant={controls.paused ? 'secondary' : 'default'}>{controls.paused ? 'Paused' : 'Controls on'}</Badge></CardAction>
    </CardHeader>
    <CardContent className="task-content">
      <article className="slide-preview" aria-labelledby="slide-title">
        <div className="slide-topline"><span>GESTUREBRIDGE / DEMO DECK</span><span>{String(view.slideIndex + 1).padStart(2, '0')}</span></div>
        <div className="slide-copy"><h2 id="slide-title">{title}</h2><p>{body}</p></div>
        <div className="slide-bottomline"><span>Your poses. Your pace.</span><span aria-hidden="true">↗</span></div>
      </article>
      <div className="presentation-feedback">
        <div className="meta-row"><span role="status">{controls.status}</span><Badge variant="outline">{view.recognition.label ? labels[view.recognition.label] : 'No pose accepted'}</Badge></div>
        <Progress value={controls.progress} aria-label="Pose hold" aria-live="off" />
      </div>
    </CardContent>
    <CardFooter className="task-actions">
      <Button size="lg" variant={controls.paused ? 'default' : 'secondary'} disabled={controls.paused && !controls.enabled} onClick={() => session.toggleControls()}>
        {controls.paused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}{controls.paused ? controls.started ? 'Resume controls' : 'Start controls' : 'Pause controls'}
      </Button>
      <div className="slide-navigation">
        <Button variant="outline" size="icon" aria-label="Previous slide" disabled={view.slideIndex === 0} onClick={() => session.changeSlide('previous')}><ArrowLeft data-icon="inline-start" /></Button>
        <span role="status" className="tabular-nums">{view.slideIndex + 1} / {slides.length}</span>
        <Button variant="outline" size="icon" aria-label="Next slide" disabled={view.slideIndex === slides.length - 1} onClick={() => session.changeSlide('next')}><ArrowRight data-icon="inline-start" /></Button>
      </div>
    </CardFooter>
  </Card>;
}

export default function App({ session, view, camera, videoRef, canvasRef }) {
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><Hand aria-hidden="true" /></span><span>GestureBridge<span className="brand-subtitle">A little movement. A new way to present.</span></span></div>
      <Badge variant="outline"><LockKeyhole />Local processing</Badge>
    </header>
    <Tabs value={view.step} onValueChange={step => session.goToStep(step)} className="workspace-tabs">
      <div className="workspace-heading"><div><p className="eyebrow">YOUR PRESENTATION WORKSPACE</p><h1>Make your next move.</h1></div>
        <TabsList className="stage-navigation" aria-label="Setup stage">
          <TabsTrigger value="teach" disabled={view.busy}><span className="stage-number">{view.trained ? <Check /> : '1'}</span>Teach</TabsTrigger>
          <TabsTrigger value="calibrate" disabled={!view.trained || view.busy}><span className="stage-number">{view.calibration.ready ? <Check /> : '2'}</span>Calibrate</TabsTrigger>
          <TabsTrigger value="present" disabled={!view.calibration.ready || view.busy}><span className="stage-number">3</span>Present</TabsTrigger>
        </TabsList>
      </div>
      <main className="workspace-grid">
        <Card className="camera-card">
          <CardHeader>
            <CardTitle>Your camera</CardTitle><CardDescription>Keep one hand comfortably in frame.</CardDescription>
            <CardAction><Badge variant="secondary">{view.camera.running ? 'Live' : view.camera.loading ? 'Loading' : 'Camera off'}</Badge></CardAction>
          </CardHeader>
          <CardContent className="camera-content">
            <div className="camera-viewport">
              <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
              <canvas ref={canvasRef} aria-hidden="true" />
              {!view.camera.running && <Empty className="camera-empty"><EmptyHeader><EmptyMedia variant="icon"><VideoOff /></EmptyMedia><EmptyTitle>Your space, on camera.</EmptyTitle><EmptyDescription>Start your camera to capture and recognise your poses.</EmptyDescription></EmptyHeader></Empty>}
              {view.camera.running && <div className="camera-overlay-badge"><Badge variant="secondary"><Hand />{view.hand.ready ? 'One hand tracked' : view.hand.count > 1 ? 'Show only one hand' : 'Show one hand'}</Badge></div>}
            </div>
            <p className="camera-status" role="status">{view.camera.message}</p>
          </CardContent>
          <CardFooter className="camera-actions">
            {view.camera.running || view.camera.loading ? <Button variant="outline" onClick={() => camera.stop()}><VideoOff data-icon="inline-start" />{view.camera.loading ? 'Cancel startup' : 'Stop camera'}</Button>
              : <Button onClick={() => camera.start()} disabled={view.camera.loading}><Video data-icon="inline-start" />{view.camera.loading ? 'Starting camera…' : 'Start camera'}</Button>}
            <span className="quiet camera-note">Video stays in this browser.</span>
          </CardFooter>
        </Card>
        <div className="stage-panels">
          <TabsContent value="teach"><Teach session={session} view={view} /></TabsContent>
          <TabsContent value="calibrate"><Calibrate session={session} view={view} /></TabsContent>
          <TabsContent value="present"><Present session={session} view={view} /></TabsContent>
        </div>
      </main>
    </Tabs>
    <footer className="workspace-footer">
      <span>Session only · reloading clears your poses.</span>
      <Collapsible className="help-panel">
        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}><CircleHelp data-icon="inline-start" />Help & diagnostics<ChevronDown data-icon="inline-end" /></CollapsibleTrigger>
        <CollapsibleContent className="help-content">
          <div><h2>A smoother setup</h2><p>Use the same hand and choose three distinct poses. Relax and slightly reposition between clips. Calibration uses fresh examples of your poses and two unrelated poses.</p><p>Hold Neutral for 0.4 seconds, then a command for 0.5 seconds. Return to Neutral before every new command. Press <kbd>Esc</kbd> to pause. This controls the built-in deck.</p></div>
          <div><h2>Recognition details</h2><p>{view.recognition.description}</p><dl className="diagnostics"><dt>Neighbour votes</dt><dd>{view.recognition.votes} / 5</dd><dt>Distance / cutoff</dt><dd>{view.recognition.distance?.toFixed(2) ?? '—'} / {view.recognition.cutoff?.toFixed(2) ?? '—'}</dd></dl><p>Votes are agreement, not confidence. Unfamiliar poses may still resemble a trained pose.</p></div>
        </CollapsibleContent>
      </Collapsible>
    </footer>
  </div>;
}
