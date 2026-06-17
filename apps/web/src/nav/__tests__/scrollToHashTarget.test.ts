// @vitest-environment happy-dom
/**
 * scrollToHashTarget (MVP-10 Task 11 review fix): the shared, crash-safe
 * hash-jump entry point. decodeURIComponent throws URIError on a malformed
 * fragment (e.g. "#%GG") — every surface (Editor/InAppView/ReadPage) routes
 * through here so a hand-typed bad hash can never take the page down.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { scrollToHashTarget } from '../scrollToBlock';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('scrollToHashTarget', () => {
  test('malformed percent-encoding is a no-op (never throws)', () => {
    expect(() => scrollToHashTarget('#%GG')).not.toThrow();
  });

  test('empty / bare-hash fragments are no-ops', () => {
    expect(() => scrollToHashTarget('')).not.toThrow();
    expect(() => scrollToHashTarget('#')).not.toThrow();
  });

  test('unknown block id is a safe no-op (no matching element)', () => {
    expect(() => scrollToHashTarget('#nope')).not.toThrow();
  });

  test('valid hash reaches the matching block (flash class applied)', () => {
    const el = document.createElement('div');
    el.setAttribute('data-block-id', 'blk 9'); // a space → must be %-encoded in the hash
    // happy-dom lacks scrollIntoView; stub so scrollToBlock can run end-to-end
    (el as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
    document.body.appendChild(el);

    scrollToHashTarget('#blk%209'); // decodes to "blk 9"
    expect(el.classList.contains('skb-block-flash')).toBe(true);
  });
});
