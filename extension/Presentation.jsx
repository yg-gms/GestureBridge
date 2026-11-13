import {
  ArrowLeft,
  ArrowRight,
  Info,
  Link,
  Pause,
  Play,
  Presentation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

export default function SlidesPresentation({
  slides,
  connection,
  controls,
  view,
  starting = false,
}) {
  const active = !view.controls.paused;
  const canNavigate =
    active && connection.connected && !connection.paused && !connection.busy;
  return (
    <Card className="task-card">
      <CardHeader>
        <p className="eyebrow">03 / PRESENT</p>
        <CardTitle>Your Google Slides</CardTitle>
        <CardDescription>
          {connection.connected
            ? connection.title
            : 'Open your deck in this window, then connect.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="task-content">
        <div className="extension-button-row">
          <Button
            variant="outline"
            onClick={() => slides.openSlideshow()}
            disabled={connection.busy}
          >
            <Presentation data-icon="inline-start" />
            Open slideshow
          </Button>
          <Button
            variant="outline"
            onClick={() => slides.connect()}
            disabled={connection.busy}
          >
            <Link data-icon="inline-start" />
            {connection.connected ? 'Reconnect tab' : 'Connect Slides tab'}
          </Button>
        </div>
        <Alert role="status">
          <Info />
          <AlertTitle>
            {connection.connected ? 'Connected' : 'Connection'}
          </AlertTitle>
          <AlertDescription>{connection.message}</AlertDescription>
        </Alert>
        <div className="presentation-feedback">
          <div className="meta-row">
            <span role="status">{view.controls.status}</span>
            <Badge variant="outline">{view.recognition.description}</Badge>
          </div>
          <Progress value={view.controls.progress} aria-label="Pose hold" />
        </div>
      </CardContent>
      <CardFooter className="task-content">
        <Button
          onClick={() => controls.toggle()}
          disabled={
            !active &&
            !starting &&
            (!connection.connected || connection.busy || !view.controls.enabled)
          }
        >
          {active || starting ? (
            <Pause data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {starting
            ? 'Cancel start'
            : active
              ? 'Pause controls'
              : 'Start gesture controls'}
        </Button>
        <div className="extension-button-row">
          <Button
            variant="outline"
            onClick={() => controls.navigate('previous')}
            disabled={!canNavigate}
          >
            <ArrowLeft data-icon="inline-start" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => controls.navigate('next')}
            disabled={!canNavigate}
          >
            Next
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <p className="quiet">
          Hold Neutral to get ready, then Next or Previous. Esc pauses while
          this panel has focus. Keep the panel open.
        </p>
      </CardFooter>
    </Card>
  );
}
