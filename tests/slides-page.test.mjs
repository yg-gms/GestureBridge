import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { runSlidesCommand } from '../extension/slides-page.mjs';

function page({
  href = 'https://docs.google.com/presentation/d/deck_1/present#slide=id.p1',
  hidden = false,
  changes = true,
  button = false,
} = {}) {
  const location = new URL(href);
  const dispatched = [];
  let now = 100;
  const advance = () => {
    if (changes) {
      if (location.searchParams.has('slide'))
        location.searchParams.set('slide', 'id.p2');
      else location.hash = '#slide=id.p2';
    }
  };
  const control = {
    getAttribute: (name) => (name === 'aria-label' ? 'Next slide' : null),
    getClientRects: () => [1],
    disabled: false,
    click: advance,
  };
  const document = {
    hidden,
    querySelectorAll: () => (button ? [control] : []),
    dispatchEvent: (event) => {
      dispatched.push(event);
      if (event.type === 'keydown') advance();
    },
  };
  const context = {
    URL,
    location,
    document,
    window: {},
    Date: { now: () => now },
    KeyboardEvent: class {
      constructor(type, options) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    setTimeout: (callback, delay) => {
      now += delay;
      callback();
    },
  };
  const run = (request = {}) =>
    vm.runInNewContext(`(${runSlidesCommand.toString()})(request)`, {
      ...context,
      request: {
        command: 'next',
        deckId: 'deck_1',
        expiresAt: 1100,
        ...request,
      },
    });
  return { run, location, dispatched };
}

test('the injected function is self-contained and confirms a changed slide token', async () => {
  const { run, dispatched } = page();
  const result = await run();
  assert.equal(result.ok, true);
  assert.equal(result.slide, 'id.p2');
  assert.equal(dispatched[0].key, 'ArrowRight');
});

test('visible navigation controls are preferred to simulated keys', async () => {
  const { run, dispatched } = page({ button: true });
  assert.equal((await run()).ok, true);
  assert.equal(dispatched.length, 0);
});

test('Slides query-string positions are read and confirmed during navigation', async () => {
  const { run } = page({
    href: 'https://docs.google.com/presentation/d/deck_1/present?slide=id.p1',
  });
  assert.equal((await run({ command: 'probe' })).slide, 'id.p1');
  assert.equal((await run()).slide, 'id.p2');
});

test('previous navigation sends the left-arrow key', async () => {
  const { run, dispatched } = page();
  assert.equal((await run({ command: 'previous' })).ok, true);
  assert.equal(dispatched[0].key, 'ArrowLeft');
  assert.equal(dispatched[0].keyCode, 37);
});

test('probe checks page support without advancing a slide', async () => {
  const { run, dispatched, location } = page();
  assert.equal((await run({ command: 'probe' })).ok, true);
  assert.equal(dispatched.length, 0);
  assert.equal(location.hash, '#slide=id.p1');
});

test('wrong pages, hidden pages, stale commands and changed decks never receive keys', async () => {
  for (const [options, request] of [
    [
      { href: 'https://example.com/presentation/d/deck_1/present#slide=id.p1' },
      {},
    ],
    [
      {
        href: 'https://docs.google.com/presentation/d/deck_1/edit#slide=id.p1',
      },
      {},
    ],
    [{ hidden: true }, {}],
    [{}, { expiresAt: 50 }],
    [{}, { deckId: 'other' }],
    [{}, { command: 'delete' }],
    [{}, { expiresAt: Infinity }],
  ]) {
    const { run, dispatched } = page(options);
    assert.equal((await run(request)).ok, false);
    assert.equal(dispatched.length, 0);
  }
});

test('unchanged or unreadable slide state is not reported as success', async () => {
  for (const options of [
    { changes: false },
    { href: 'https://docs.google.com/presentation/d/deck_1/present' },
  ]) {
    const { run } = page(options);
    assert.equal((await run()).ok, false);
  }
});
