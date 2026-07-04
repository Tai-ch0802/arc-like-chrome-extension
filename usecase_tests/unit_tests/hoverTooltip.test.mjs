/**
 * @jest-environment jsdom
 *
 * Unit tests for the native-title suppression in the Hover Summarize tooltip.
 *
 * The browser paints an element's `title` attribute as a built-in tooltip above
 * all page content; for a tab row (title="<title>\n<url>") it lands on top of
 * our summary tooltip and hides every line but the first. suppressAnchorTitle /
 * restoreAnchorTitle stash and restore that attribute so only our tooltip shows.
 */
import { suppressAnchorTitle, restoreAnchorTitle } from '../../modules/ui/hoverTooltip.js';

function anchor(title) {
    const el = document.createElement('div');
    if (title !== undefined) el.title = title;
    return el;
}

afterEach(() => {
    // Reset the module's single "currently suppressed" slot between tests.
    restoreAnchorTitle();
});

describe('hoverTooltip native title suppression', () => {
    it('removes and stashes the live title, then restores it verbatim', () => {
        const el = anchor('Example\nhttps://example.com');
        suppressAnchorTitle(el);
        expect(el.hasAttribute('title')).toBe(false);
        expect(el.dataset.hoverNativeTitle).toBe('Example\nhttps://example.com');

        restoreAnchorTitle();
        expect(el.getAttribute('title')).toBe('Example\nhttps://example.com');
        expect(el.dataset.hoverNativeTitle).toBeUndefined();
    });

    it('restores the previous anchor before suppressing a new one (fast tab-to-tab hover)', () => {
        const a = anchor('A\nurlA');
        const b = anchor('B\nurlB');
        suppressAnchorTitle(a);
        suppressAnchorTitle(b);

        expect(a.getAttribute('title')).toBe('A\nurlA'); // a handed back
        expect(a.dataset.hoverNativeTitle).toBeUndefined();
        expect(b.hasAttribute('title')).toBe(false);     // b now suppressed
        expect(b.dataset.hoverNativeTitle).toBe('B\nurlB');
    });

    it('is idempotent for the same anchor (repeated mouseover keeps the stashed value)', () => {
        const el = anchor('T\nurl');
        suppressAnchorTitle(el);
        suppressAnchorTitle(el); // must not overwrite the stash with the (now empty) live title
        expect(el.dataset.hoverNativeTitle).toBe('T\nurl');

        restoreAnchorTitle();
        expect(el.getAttribute('title')).toBe('T\nurl');
    });

    it('tolerates an anchor that has no title attribute', () => {
        const el = anchor();
        expect(() => suppressAnchorTitle(el)).not.toThrow();
        expect(el.hasAttribute('title')).toBe(false);
        expect(el.dataset.hoverNativeTitle).toBeUndefined();
        expect(() => restoreAnchorTitle()).not.toThrow();
    });

    it('restoreAnchorTitle is a no-op when nothing is suppressed', () => {
        expect(() => restoreAnchorTitle()).not.toThrow();
    });

    it('does not restore a stale value when the row was re-rendered into a fresh stash', () => {
        // Simulates tabRenderer updating the stash mid-hover (dataset write path).
        const el = anchor('Old\nurlOld');
        suppressAnchorTitle(el);
        el.dataset.hoverNativeTitle = 'New\nurlNew'; // tabRenderer refreshed the stash
        restoreAnchorTitle();
        expect(el.getAttribute('title')).toBe('New\nurlNew');
    });
});
