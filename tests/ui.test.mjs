import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { GestureSession } from '../session.mjs';

let server;
let App;
let Spike;
before(async () => {
  server = await createServer({
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  App = (await server.ssrLoadModule('/src/App.jsx')).default;
  Spike = (await server.ssrLoadModule('/extension/Presentation.jsx')).default;
});
after(async () => {
  await server?.close();
});

function render(view) {
  return renderToStaticMarkup(
    React.createElement(App, {
      session: {},
      camera: {},
      videoRef: null,
      canvasRef: null,
      view,
    }),
  );
}

test('initial setup renders one focused task with a persistent camera', () => {
  const html = render(new GestureSession().snapshot());
  assert.match(html, /Record clip/);
  assert.doesNotMatch(html, /A quick reality check/);
  assert.doesNotMatch(html, /Your hands take it from here/);
  assert.equal((html.match(/<video\b/g) ?? []).length, 1);
});

test('a paused presentation explains its current blocker instead of an old setup message', () => {
  const view = new GestureSession().snapshot();
  view.step = 'present';
  view.message = 'Calibration passed. Start gesture controls.';
  view.calibration.ready = true;
  const html = render(view);
  assert.ok(
    html.includes('Start the camera to enable gesture controls'),
    'Show the current camera requirement',
  );
  assert.ok(
    !html.includes('Calibration passed'),
    'Hide the stale calibration message',
  );
});

test('camera startup exposes an enabled cancel action', () => {
  const view = new GestureSession().snapshot();
  view.camera.loading = true;
  view.camera.message = 'Allow camera access to continue.';
  const html = render(view);
  const cancel = (html.match(/<button\b[\s\S]*?<\/button>/g) ?? []).find(
    (button) => button.includes('Cancel startup'),
  );
  assert.ok(cancel, 'Show a cancel action while camera access is pending');
  assert.ok(
    !/aria-disabled="true"|\sdisabled(?:=|\s|>)/.test(cancel),
    'Keep the cancel action enabled',
  );
});

test('the extension keeps Pause available during an in-flight navigation', () => {
  const html = renderToStaticMarkup(
    React.createElement(Spike, {
      slides: {},
      controls: {},
      connection: {
        connected: true,
        paused: false,
        busy: true,
        title: 'Test deck',
        message: 'Checking…',
      },
      view: {
        ...new GestureSession().snapshot(),
        controls: {
          paused: false,
          enabled: true,
          progress: 0,
          status: 'Hold Neutral',
        },
      },
    }),
  );
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
  const pause = buttons.find((button) => button.includes('Pause controls'));
  const next = buttons.find(
    (button) => button.replace(/<[^>]*>/g, '').trim() === 'Next',
  );
  assert.ok(pause && !/aria-disabled="true"|\sdisabled(?:=|\s|>)/.test(pause));
  assert.ok(next && /aria-disabled="true"|\sdisabled(?:=|\s|>)/.test(next));
});

test('extension presentation replaces the demo while retaining the training workflow and one camera', () => {
  const view = new GestureSession().snapshot();
  view.step = 'present';
  const html = renderToStaticMarkup(
    React.createElement(App, {
      session: {},
      camera: {},
      view,
      presentation: React.createElement(Spike, {
        slides: {},
        controls: {},
        connection: { connected: false, paused: true, busy: false },
        view,
      }),
      footer: 'Poses saved on this computer.',
      helpTarget: 'Controls the connected Google Slides tab.',
    }),
  );
  assert.match(html, /Connect Slides tab/);
  assert.match(html, /Poses saved on this computer/);
  assert.doesNotMatch(
    html,
    /DEMO DECK|reloading clears your poses|This controls the built-in deck/,
  );
  assert.equal((html.match(/<video\b/g) ?? []).length, 1);
});
