import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCamera } from '../camera.mjs';
import { GestureSession } from '../session.mjs';
import { SlidesController } from './slides.mjs';
import { GestureSlides } from './gesture-slides.mjs';
import { TrainingStore } from './training-store.mjs';
import { cameraPermissionReady } from './camera-permission.mjs';
import App from '../src/App.jsx';
import SlidesPresentation from './Presentation.jsx';
import { Button } from '@/components/ui/button';
import '../src/styles.css';
import '../src/workspace.css';
import './workspace.css';

function ExtensionWorkspace() {
  const [session] = useState(() => new GestureSession());
  const [slides] = useState(() => new SlidesController({ api: chrome }));
  const [view, setView] = useState(() => session.snapshot());
  const [connection, setConnection] = useState(() => slides.snapshot());
  const [starting, setStarting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState({
    message: 'Loading saved setup…',
    error: false,
  });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const bridgeRef = useRef(null);
  const storeRef = useRef(null);
  const [controls] = useState(() => ({
    toggle: () => bridgeRef.current?.toggle(),
    navigate: (command) => bridgeRef.current?.navigate(command),
  }));
  const [camera] = useState(() => ({
    start: async () => {
      try {
        if (await cameraPermissionReady(chrome))
          return cameraRef.current?.start();
        session.setCameraState({
          message:
            'Allow access in the camera setup tab, then return here and start again.',
        });
      } catch {
        session.setCameraState({
          message:
            'Could not open camera setup. Reload the extension and try again.',
        });
      }
    },
    stop: () => cameraRef.current?.stop(),
  }));

  useEffect(() => {
    let disposed = false;
    const bridge = new GestureSlides(session, slides, () => {
      if (disposed) return;
      setView(session.snapshot());
      setConnection(slides.snapshot());
      setStarting(bridge.starting);
    });
    bridgeRef.current = bridge;
    const store = new TrainingStore(session, chrome.storage.local, (status) => {
      if (!disposed) setSaved(status);
    });
    storeRef.current = store;
    const load = async () => {
      try {
        await chrome.storage.local.setAccessLevel({
          accessLevel: 'TRUSTED_CONTEXTS',
        });
        await store.load();
      } catch {
        store.report(
          'Could not access saved poses. Reload the extension and retry.',
          true,
          'load',
        );
      }
      if (!disposed) {
        session.onTrainingChange = () => {
          void store.save();
        };
        setLoaded(true);
      }
    };
    void load();
    const controller = createCamera({
      video: videoRef.current,
      canvas: canvasRef.current,
      session,
    });
    cameraRef.current = controller;
    const visibility = () => {
      session.setHidden(document.hidden);
      if (document.hidden)
        bridge.pause(
          'Panel hidden. Return to the slideshow and start controls again.',
        );
    };
    const keydown = (event) => {
      if (event.key === 'Escape') bridge.pause();
    };
    const pagehide = () => {
      bridge.pause();
      controller.stop();
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', keydown);
    window.addEventListener('pagehide', pagehide);
    return () => {
      disposed = true;
      session.onTrainingChange = () => {};
      bridge.dispose();
      slides.dispose();
      controller.dispose();
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [slides, session]);

  const footer = (
    <div className="extension-saved">
      <p role="status">{saved.message}</p>
      <div className="extension-button-row">
        {saved.error && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              saved.action === 'load'
                ? storeRef.current?.load()
                : storeRef.current?.save()
            }
            disabled={!loaded || view.busy}
          >
            {saved.action === 'load' ? 'Retry loading' : 'Retry saving'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={!loaded || view.busy}
          onClick={() => {
            bridgeRef.current?.pause();
            session.resetTraining();
          }}
        >
          Reset setup
        </Button>
      </div>
    </div>
  );
  return (
    <div className="extension-workspace" inert={!loaded}>
      <App
        session={session}
        view={view}
        camera={camera}
        videoRef={videoRef}
        canvasRef={canvasRef}
        presentation={
          <SlidesPresentation
            slides={slides}
            connection={connection}
            controls={controls}
            view={view}
            starting={starting}
          />
        }
        footer={footer}
        helpTarget="Controls the connected Google Slides tab. Keep this panel open. Saved poses stay on this computer; recalibrate after reopening."
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  globalThis.chrome?.scripting && globalThis.chrome?.storage ? (
    <ExtensionWorkspace />
  ) : (
    <p>
      Load the built folder through Chrome’s Load unpacked action. This is an
      extension, not a website.
    </p>
  ),
);
