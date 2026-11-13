import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('toolbar click explicitly invokes the action before opening the side panel', async () => {
  let clicked;
  const opened = [];
  const behavior = [];
  vm.runInNewContext(
    await readFile(
      new URL('../extension/background.js', import.meta.url),
      'utf8',
    ),
    {
      chrome: {
        action: { onClicked: { addListener: (fn) => (clicked = fn) } },
        sidePanel: {
          setPanelBehavior: async (value) => behavior.push(value),
          open: async (value) => opened.push(value),
        },
      },
      console,
    },
  );
  assert.equal(typeof clicked, 'function');
  clicked({ id: 7 });
  assert.equal(opened[0].tabId, 7);
  assert.equal(behavior[0].openPanelOnActionClick, false);
});
