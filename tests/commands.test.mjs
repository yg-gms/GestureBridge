import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandGate } from '../commands.mjs';

function hold(gate, label, start, duration) {
  const commands = [];
  for (let now = start; now <= start + duration; now += 100) {
    const command = gate.update(label, now);
    if (command) commands.push(command);
  }
  return commands;
}

test('commands cannot fire before valid Neutral has been held for 400 ms', () => {
  const gate = new CommandGate();
  assert.deepEqual(hold(gate, 'next', 0, 1000), []);
  hold(gate, 'neutral', 1100, 300);
  assert.equal(gate.armed, false);
  assert.equal(gate.update('neutral', 1500), null);
  assert.equal(gate.armed, true);
});

test('each command fires at 500 ms, once, and requires Neutral before another', () => {
  for (const label of ['next', 'previous']) {
    const gate = new CommandGate();
    hold(gate, 'neutral', 0, 400);
    assert.deepEqual(hold(gate, label, 500, 400), []);
    assert.equal(gate.update(label, 1000), label);
    assert.deepEqual(hold(gate, label, 1100, 1000), []);
    assert.deepEqual(
      hold(gate, label === 'next' ? 'previous' : 'next', 2200, 600),
      [],
    );
    hold(gate, 'neutral', 2900, 400);
    assert.deepEqual(hold(gate, label, 3400, 500), [label]);
  }
});

test('uncertainty and label changes restart the command hold', () => {
  for (const interruption of [null, 'previous', 'neutral', 'invalid']) {
    const gate = new CommandGate();
    hold(gate, 'neutral', 0, 400);
    hold(gate, 'next', 500, 400);
    assert.equal(gate.update(interruption, 1000), null);
    assert.deepEqual(hold(gate, 'next', 1100, 400), []);
    assert.equal(gate.update('next', 1600), 'next');
  }
});

test('an interrupted Neutral hold cannot rearm', () => {
  const gate = new CommandGate();
  hold(gate, 'neutral', 0, 300);
  gate.update(null, 400);
  hold(gate, 'neutral', 500, 300);
  assert.equal(gate.armed, false);
  assert.equal(gate.update('neutral', 900), null);
  assert.equal(gate.armed, true);
});

test('reset cancels a pending command and requires Neutral again', () => {
  const gate = new CommandGate();
  hold(gate, 'neutral', 0, 400);
  hold(gate, 'next', 500, 400);
  gate.reset();
  assert.deepEqual(hold(gate, 'next', 1000, 1000), []);
  hold(gate, 'neutral', 2100, 400);
  assert.deepEqual(hold(gate, 'previous', 2600, 500), ['previous']);
});

test('a frame gap cannot count as a continuous command or Neutral hold', () => {
  const gate = new CommandGate();
  hold(gate, 'neutral', 0, 400);
  gate.update('next', 500);
  assert.equal(gate.update('next', 1500), null);
  assert.equal(gate.armed, false);
  gate.update('neutral', 1600);
  gate.update('neutral', 2600);
  assert.equal(gate.armed, false);
  hold(gate, 'neutral', 2700, 300);
  assert.equal(gate.armed, true);
});

test('invalid and backwards timestamps discard activation state', () => {
  for (const now of [NaN, Infinity, undefined, 100]) {
    const gate = new CommandGate();
    hold(gate, 'neutral', 0, 400);
    hold(gate, 'next', 500, 400);
    assert.equal(gate.update('next', now), null);
    assert.equal(gate.armed, false);
    assert.deepEqual(hold(gate, 'next', 1000, 600), []);
  }
});
