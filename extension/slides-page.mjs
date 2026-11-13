// Chrome serializes this function, so everything it needs must be inside it.
export async function runSlidesCommand(request) {
  const fail = (message) => ({ ok: false, message });
  const url = new URL(location.href);
  const match = url.pathname.match(
    /^\/presentation\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)\/(present|preview)\/?$/,
  );
  if (
    url.origin !== 'https://docs.google.com' ||
    !match ||
    match[1] !== request?.deckId
  ) {
    return fail(
      'Unsupported page. Open the selected Google Slides slideshow first.',
    );
  }
  if (
    !['probe', 'next', 'previous'].includes(request.command) ||
    !Number.isFinite(request.expiresAt) ||
    request.expiresAt <= Date.now() ||
    request.expiresAt > Date.now() + 2000
  ) {
    return fail('Invalid or expired command. Resume and try again.');
  }
  if (document.hidden)
    return fail('Presentation is hidden. Return to it and resume.');
  const readSlide = () =>
    new URL(location.href).searchParams.get('slide') ||
    location.hash.match(/(?:^#|&)slide=([^&]+)/)?.[1] ||
    null;
  const before = readSlide();
  if (!before)
    return fail(
      'Cannot read the current slide. Use an arrow key once, then connect again.',
    );
  if (request.command === 'probe') return { ok: true, slide: before };

  const next = request.command === 'next';
  const names = next ? ['next slide', 'next'] : ['previous slide', 'previous'];
  const button = [
    ...document.querySelectorAll(
      'button[aria-label], [role="button"][aria-label]',
    ),
  ].find(
    (control) =>
      names.includes(
        control.getAttribute('aria-label')?.split('(')[0].trim().toLowerCase(),
      ) &&
      control.getClientRects().length > 0 &&
      !control.disabled &&
      control.getAttribute('aria-disabled') !== 'true',
  );
  if (button) button.click();
  else {
    // shortcut: Slides has no public navigation API; verify each attempt by its slide token.
    for (const type of ['keydown', 'keyup'])
      document.dispatchEvent(
        new KeyboardEvent(type, {
          key: next ? 'ArrowRight' : 'ArrowLeft',
          code: next ? 'ArrowRight' : 'ArrowLeft',
          keyCode: next ? 39 : 37,
          which: next ? 39 : 37,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
  }

  const start = Date.now();
  while (Date.now() - start < 750) {
    if (document.hidden)
      return fail(
        'Presentation became hidden. Resume before sending another command.',
      );
    const after = readSlide();
    if (after && after !== before) return { ok: true, slide: after };
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return fail(
    'No slide change was confirmed. Check slide boundaries or animations, then resume.',
  );
}
