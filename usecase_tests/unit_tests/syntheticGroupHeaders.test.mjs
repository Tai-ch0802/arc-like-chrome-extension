/**
 * @jest-environment jsdom
 *
 * ISSUE-263 (supersedes the ISSUE-261 flat rendering): tabs whose `groupId`
 * has no entry in the tabGroups query result are rendered under a SYNTHETIC
 * group header instead of flat or dropped.
 *
 * Dia pins a Tab Group by removing it from Chromium's TabGroupModel while the
 * member tabs keep their groupId, so the only way to show the hierarchy is to
 * rebuild the group from membership. Title/color come from groupMetaCache when
 * it saw the group unpinned; otherwise the members' common host, then a
 * localized "Pinned group". Chrome only hits this path for one frame when a
 * group is created between the two queries behind a render.
 */
import './sidePanelDomFixture.js'; // must come first: sets up DOM + chrome stub
import * as tabRenderer from '../../modules/ui/tabRenderer.js';
import * as otherWindowRenderer from '../../modules/ui/otherWindowRenderer.js';

function fakeTab(id, index, groupId, extra = {}) {
    return {
        id,
        index,
        groupId,
        windowId: 10,
        title: `Tab ${id}`,
        url: `https://example.com/${id}`,
        favIconUrl: '',
        active: false,
        pinned: false,
        ...extra,
    };
}

function fakeGroup(id, extra = {}) {
    return { id, title: `Group ${id}`, color: 'blue', collapsed: false, windowId: 10, ...extra };
}

function fakeMeta({ resolve = () => null, collapsed = {} } = {}) {
    return {
        resolve: jest.fn(resolve),
        isCollapsed: jest.fn((id) => collapsed[id] === true),
        setCollapsed: jest.fn(async (id, v) => { collapsed[id] = v; }),
    };
}

const noop = () => {};
const list = () => document.getElementById('tab-list');
const rowIds = (container) => Array.from(container.querySelectorAll('.tab-item')).map(el => Number(el.dataset.tabId));
const headers = () => Array.from(list().querySelectorAll('.tab-group-header'));
const flush = () => new Promise(r => setTimeout(r, 0));
const render = (tabs, groups, groupMeta = fakeMeta()) =>
    tabRenderer.renderTabsAndGroups(tabs, groups, { onAddToGroupClick: noop, groupMeta });

beforeEach(() => {
    tabRenderer.resetTabListeners();
    otherWindowRenderer.resetOtherWindowCaches();
    list().innerHTML = '';
    document.getElementById('other-windows-list').innerHTML = '';
    globalThis.chrome.tabGroups.update = jest.fn(async () => ({}));
});

describe('renderTabsAndGroups — groups the browser hides (Dia pinned groups)', () => {
    it('renders a synthetic header + content per unknown group, members in index order, at the first member\'s position', () => {
        const tabs = [
            fakeTab(1, 0, 2),
            fakeTab(2, 1, 2),
            fakeTab(3, 2, -1),
            fakeTab(4, 3, 2), // Dia groups are not contiguous in index order
            fakeTab(5, 4, 3),
        ];
        render(tabs, []);

        const [h2, h3] = headers();
        expect(headers().length).toBe(2);
        expect(h2.classList.contains('is-synthetic')).toBe(true);
        expect(h2.dataset.syntheticGroupId).toBe('2');
        expect(h2.dataset.groupId).toBeUndefined();
        expect(h2.getAttribute('role')).toBe('button');
        expect(h2.tabIndex).toBe(0);

        const c2 = h2.nextElementSibling;
        expect(c2.classList.contains('tab-group-content')).toBe(true);
        expect(c2.classList.contains('is-synthetic')).toBe(true);
        expect(rowIds(c2)).toEqual([1, 2, 4]);
        for (const row of c2.querySelectorAll('.tab-item')) {
            // Not a real group: drag/drop and tabListeners key group ops on dataset.groupId.
            expect(row.dataset.groupId).toBeUndefined();
            expect(row.dataset.syntheticGroupId).toBe('2');
        }
        expect(rowIds(h3.nextElementSibling)).toEqual([5]);

        const kinds = Array.from(list().children).map(el => el.classList[0]);
        expect(kinds).toEqual(['tab-group-header', 'tab-group-content', 'tab-item', 'tab-group-header', 'tab-group-content']);
        expect(list().children[2].dataset.tabId).toBe('3');
        expect(list().children[2].dataset.groupId).toBeUndefined();

        // searchManager hides/expands headers through this cache, keyed by the real groupId.
        expect(tabRenderer.getGroupHeaderElementsCache().get(2)).toBe(h2);
        expect(tabRenderer.getGroupHeaderElementsCache().get(3)).toBe(h3);
    });

    it('uses the cached title/color when the meta cache resolves the group', () => {
        const meta = fakeMeta({ resolve: (id) => (id === 2 ? { title: 'capy-music_TEST', color: 'purple', source: 'session' } : null) });
        render([fakeTab(1, 0, 2), fakeTab(2, 1, 2)], [], meta);

        const [h] = headers();
        expect(h.querySelector('.tab-group-title').textContent).toBe('capy-music_TEST');
        expect(h.title).toBe('capy-music_TEST');
        expect(h.querySelector('.tab-group-color-dot').style.backgroundColor).toBe('rgb(197, 138, 249)'); // GROUP_COLORS.purple
        expect(meta.resolve).toHaveBeenCalledWith(2, [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })]);
    });

    it('falls back to the members\' common host, then to "Pinned group" with a recovery hint', () => {
        render([
            fakeTab(1, 0, 2, { url: 'https://www.github.com/a' }),
            fakeTab(2, 1, 2, { url: 'https://github.com/b' }),
            fakeTab(3, 2, 5, { url: 'https://a.com/' }),
            fakeTab(4, 3, 5, { url: 'https://b.com/' }),
        ], []);

        const [h2, h5] = headers();
        expect(h2.querySelector('.tab-group-title').textContent).toBe('github.com');
        expect(h5.querySelector('.tab-group-title').textContent).toBe('Pinned group'); // fixture i18n returns ''
        expect(h5.title).toContain('unpin and pin');
        expect(h5.querySelector('.tab-group-color-dot').style.backgroundColor).toBe('rgb(95, 99, 104)'); // grey
        expect(h2.querySelector('.tab-group-pin')).not.toBeNull();
        expect(h5.querySelector('.tab-group-pin')).not.toBeNull();
    });

    it('applies the locally stored collapsed state', () => {
        render([fakeTab(1, 0, 2), fakeTab(2, 1, 2)], [], fakeMeta({ collapsed: { 2: true } }));
        const [h] = headers();
        expect(h.dataset.collapsed).toBe('true');
        expect(h.getAttribute('aria-expanded')).toBe('false');
        expect(h.nextElementSibling.style.display).toBe('none');
        expect(h.querySelector('.tab-group-arrow').classList.contains('is-collapsed')).toBe(true);
    });

    it('clicking a synthetic header toggles it locally and never calls tabGroups.update', async () => {
        const meta = fakeMeta();
        render([fakeTab(1, 0, 2)], [], meta);
        const [h] = headers();

        h.click();
        await flush();
        expect(h.dataset.collapsed).toBe('true');
        expect(h.getAttribute('aria-expanded')).toBe('false');
        expect(h.nextElementSibling.style.display).toBe('none');
        expect(meta.setCollapsed).toHaveBeenCalledWith(2, true);
        expect(globalThis.chrome.tabGroups.update).not.toHaveBeenCalled();

        h.click();
        await flush();
        expect(h.dataset.collapsed).toBe('false');
        expect(h.nextElementSibling.style.display).toBe('block');
        expect(meta.setCollapsed).toHaveBeenLastCalledWith(2, false);
    });

    it('still renders known groups under their real header and collapses them through the API (Chrome path unchanged)', async () => {
        const meta = fakeMeta();
        render([fakeTab(1, 0, 2), fakeTab(2, 1, 2), fakeTab(3, 2, -1)], [fakeGroup(2)], meta);

        const [h] = headers();
        expect(headers().length).toBe(1);
        expect(h.classList.contains('is-synthetic')).toBe(false);
        expect(h.dataset.groupId).toBe('2');
        expect(h.dataset.syntheticGroupId).toBeUndefined();
        expect(h.querySelector('.tab-group-pin')).toBeNull();
        expect(h.querySelector('.tab-group-title').textContent).toBe('Group 2');
        const content = h.nextElementSibling;
        expect(content.classList.contains('is-synthetic')).toBe(false);
        expect(rowIds(content)).toEqual([1, 2]);
        for (const row of content.querySelectorAll('.tab-item')) {
            expect(row.dataset.groupId).toBe('2');
            expect(row.dataset.syntheticGroupId).toBeUndefined();
        }
        const ungrouped = list().querySelector('.tab-item[data-tab-id="3"]');
        expect(ungrouped.parentElement).toBe(list());
        expect(ungrouped.dataset.groupId).toBeUndefined();
        expect(meta.resolve).not.toHaveBeenCalled();

        h.click();
        await flush();
        expect(globalThis.chrome.tabGroups.update).toHaveBeenCalledWith(2, { collapsed: true });
        expect(meta.setCollapsed).not.toHaveBeenCalled();
    });

    it('mixes known and unknown groups: known under the real header, unknown under a synthetic one', () => {
        render([fakeTab(1, 0, 2), fakeTab(2, 1, 9), fakeTab(3, 2, 2)], [fakeGroup(2)]);

        const hs = headers();
        expect(hs.length).toBe(2);
        const real = hs.find(h => h.dataset.groupId === '2');
        const synthetic = hs.find(h => h.dataset.syntheticGroupId === '9');
        expect(real.classList.contains('is-synthetic')).toBe(false);
        expect(synthetic.classList.contains('is-synthetic')).toBe(true);
        expect(rowIds(real.nextElementSibling)).toEqual([1, 3]);
        expect(rowIds(synthetic.nextElementSibling)).toEqual([2]);
    });

    it('swaps a synthetic group for the real header once the browser reports it, reusing rows, and back', () => {
        const tabs = [fakeTab(1, 0, 2), fakeTab(2, 1, -1)];

        render(tabs, []);
        const row = list().querySelector('.tab-item[data-tab-id="1"]');
        expect(row.parentElement.classList.contains('is-synthetic')).toBe(true);
        expect(row.dataset.syntheticGroupId).toBe('2');
        expect(row.dataset.groupId).toBeUndefined();

        render(tabs, [fakeGroup(2)]); // Dia unpinned it (or Chrome's next frame)
        const rowAfter = list().querySelector('.tab-item[data-tab-id="1"]');
        expect(rowAfter).toBe(row); // element reused from the cache
        expect(rowAfter.parentElement.classList.contains('tab-group-content')).toBe(true);
        expect(rowAfter.parentElement.classList.contains('is-synthetic')).toBe(false);
        expect(rowAfter.dataset.groupId).toBe('2');
        expect(rowAfter.dataset.syntheticGroupId).toBeUndefined();
        expect(headers().length).toBe(1);
        expect(headers()[0].classList.contains('is-synthetic')).toBe(false);
        expect(headers()[0].dataset.groupId).toBe('2');
        expect(headers()[0].dataset.syntheticGroupId).toBeUndefined();

        render(tabs, []); // pinned again
        expect(list().querySelector('.tab-item[data-tab-id="1"]')).toBe(row);
        expect(row.parentElement.classList.contains('is-synthetic')).toBe(true);
        expect(row.dataset.syntheticGroupId).toBe('2');
        expect(row.dataset.groupId).toBeUndefined();
        expect(headers().length).toBe(1);
        expect(headers()[0].classList.contains('is-synthetic')).toBe(true);
        expect(headers()[0].dataset.groupId).toBeUndefined();
    });
});

describe('renderOtherWindowsSection — groups the browser hides', () => {
    const otherWindow = (tabs) => ({ id: 20, type: 'normal', tabs: tabs.map(t => ({ ...t, windowId: 20 })) });
    const folder = () => document.querySelector('#other-windows-list .folder-content');

    it('renders a synthetic header inside the window folder, keyed in the header cache, collapsing locally', async () => {
        const meta = fakeMeta({ resolve: () => ({ title: 'Work', color: 'red', source: 'fingerprint' }) });
        otherWindowRenderer.renderOtherWindowsSection(
            [otherWindow([fakeTab(1, 0, 5), fakeTab(2, 1, -1), fakeTab(3, 2, 5)])], 10, [], { groupMeta: meta },
        );

        const h = folder().querySelector('.tab-group-header');
        expect(h.classList.contains('is-synthetic')).toBe(true);
        expect(h.dataset.syntheticGroupId).toBe('5');
        expect(h.dataset.groupId).toBeUndefined();
        expect(h.querySelector('.tab-group-title').textContent).toBe('Work');
        expect(h.querySelector('.tab-group-color-dot').style.backgroundColor).toBe('rgb(242, 139, 130)'); // red
        expect(h.querySelector('.tab-group-pin')).not.toBeNull();
        const content = h.nextElementSibling;
        expect(content.classList.contains('is-synthetic')).toBe(true);
        expect(rowIds(content)).toEqual([1, 3]);
        for (const row of content.querySelectorAll('.tab-item')) {
            expect(row.dataset.syntheticGroupId).toBe('5');
            expect(row.dataset.groupId).toBeUndefined();
        }
        expect(folder().querySelector('.tab-item[data-tab-id="2"]').parentElement).toBe(folder());
        expect(otherWindowRenderer.getOtherGroupHeaderElementsCache().get(5)).toBe(h);

        h.click();
        await flush();
        expect(content.style.display).toBe('none');
        expect(h.getAttribute('aria-expanded')).toBe('false');
        expect(meta.setCollapsed).toHaveBeenCalledWith(5, true);
        expect(globalThis.chrome.tabGroups.update).not.toHaveBeenCalled();
    });

    it('starts collapsed when the local state says so', () => {
        otherWindowRenderer.renderOtherWindowsSection(
            [otherWindow([fakeTab(1, 0, 5)])], 10, [], { groupMeta: fakeMeta({ collapsed: { 5: true } }) },
        );
        const h = folder().querySelector('.tab-group-header');
        expect(h.dataset.collapsed).toBe('true');
        expect(h.nextElementSibling.style.display).toBe('none');
    });

    it('still renders known groups under their header (Chrome path unchanged)', () => {
        const tabs = [fakeTab(1, 0, 5), fakeTab(2, 1, -1), fakeTab(3, 2, 5)];
        otherWindowRenderer.renderOtherWindowsSection([otherWindow(tabs)], 10, [fakeGroup(5, { windowId: 20 })]);

        const hs = folder().querySelectorAll('.tab-group-header');
        expect(hs.length).toBe(1);
        expect(hs[0].classList.contains('is-synthetic')).toBe(false);
        expect(hs[0].dataset.groupId).toBe('5');
        expect(rowIds(folder().querySelector('.tab-group-content'))).toEqual([1, 3]);
        for (const row of folder().querySelectorAll('.tab-group-content .tab-item')) {
            expect(row.dataset.groupId).toBe('5');
            expect(row.dataset.syntheticGroupId).toBeUndefined();
        }
        const ungrouped = folder().querySelector('.tab-item[data-tab-id="2"]');
        expect(ungrouped.parentElement).toBe(folder());
    });
});
