import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GestureSession } from '../session.mjs';
import { createCamera } from '../camera.mjs';
import App from './App.jsx';
import './styles.css';
import './workspace.css';

function Workspace() {
  const [session] = useState(() => new GestureSession());
  const [view, setView] = useState(() => session.snapshot());
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const [camera] = useState(() => ({
    start: () => cameraRef.current?.start(),
    stop: () => cameraRef.current?.stop(),
  }));

  useEffect(() => {
    session.onChange = setView;
    const controller = createCamera({ video: videoRef.current, canvas: canvasRef.current, session });
    cameraRef.current = controller;
    const visibility = () => session.setHidden(document.hidden);
    const keydown = event => { if (event.key === 'Escape') session.pause(); };
    const pagehide = () => controller.stop();
    visibility();
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', keydown);
    window.addEventListener('pagehide', pagehide);
    return () => {
      session.onChange = () => {};
      controller.dispose();
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [session]);

  return <App session={session} view={view} camera={camera} videoRef={videoRef} canvasRef={canvasRef} />;
}

createRoot(document.getElementById('root')).render(<Workspace />);
