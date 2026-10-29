/**
 * @jest-environment jsdom
 *
 * Regression (ISSUE-261): tabs whose `groupId` has no matching entry in the
 * tabGroups query result must still be rendered (flat, in tab-strip order)
 * instead of being dropped.
 *
 * Dia (The Browser Company) reports `groupId > 0` on tabs that belong to its
 * native Tab Groups but returns `[]` from `chrome.tabGroups.query()`, so every
 * grouped tab vanished from the side panel. Chrome can hit the same path for
 * one frame when a group is created between the two queries behind a render.
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

function rowIds(container) {
    return Array.from(container.querySelectorAll('.tab-item')).map(el => Number(el.dataset.tabId));
}

beforeEach(() => {
    tabRenderer.resetTabListeners();
    otherWindowRenderer.resetOtherWindowCaches();
    document.getElementById('tab-list').innerHTML = '';
    document.getElementById('other-windows-list').innerHTML = '';
});

describe('renderTabsAndGroups — grouped tabs whose group is unknown', () => {
    const noop = () => {};

    it('renders them flat in tab-strip order instead of dropping them (Dia: tabGroups.query → [])', () => {
        const tabs = [
            fakeTab(1, 0, 2),
            fakeTab(2, 1, 2),
            fakeTab(3, 2, -1),
            fakeTab(4, 3, 2), // Dia groups are not contiguous in index order
            fakeTab(5, 4, 3),
        ];
        tabRenderer.renderTabsAndGroups(tabs, [], { onAddToGroupClick: noop });

        const list = document.getElementById('tab-list');
        expect(rowIds(list)).toEqual([1, 2, 3, 4, 5]);
        expect(list.querySelectorAll('.tab-group-header').length).toBe(0);
        expect(list.querySelectorAll('.tab-group-content').length).toBe(0);
        // Every row is a direct child (flat), none pretends to belong to a group
        // that the page has no header for (drag/drop and search key on dataset.groupId).
        for (const row of list.querySelectorAll('.tab-item')) {
            expect(row.parentElement).toBe(list);
            expect(row.dataset.groupId).toBeUndefined();
        }
    });

    it('still renders known groups under their header (Chrome path unchanged)', () => {
        const tabs = [fakeTab(1, 0, 2), fakeTab(2, 1, 2), fakeTab(3, 2, -1)];
        tabRenderer.renderTabsAndGroups(tabs, [fakeGroup(2)], { onAddToGroupClick: noop });

        const list = document.getElementById('tab-list');
        const headers = list.querySelectorAll('.tab-group-header');
        expect(headers.length).toBe(1);
        expect(headers[0].dataset.groupId).toBe('2');
        const content = list.querySelector('.tab-group-content');
        expect(rowIds(content)).toEqual([1, 2]);
        for (const row of content.querySelectorAll('.tab-item')) {
            expect(row.dataset.groupId).toBe('2');
        }
        // The ungrouped tab stays top-level, after the group block.
        const ungrouped = list.querySelector('.tab-item[data-tab-id="3"]');
        expect(ungrouped.parentElement).toBe(list);
        expect(ungrouped.dataset.groupId).toBeUndefined();
    });

    it('mixes known and unknown groups: known grouped, unknown flat', () => {
        const tabs = [fakeTab(1, 0, 2), fakeTab(2, 1, 9), fakeTab(3, 2, 2)];
        tabRenderer.renderTabsAndGroups(tabs, [fakeGroup(2)], { onAddToGroupClick: noop });

        const list = document.getElementById('tab-list');
        expect(list.querySelectorAll('.tab-group-header').length).toBe(1);
        expect(rowIds(list.querySelector('.tab-group-content'))).toEqual([1, 3]);
        const orphan = list.querySelector('.tab-item[data-tab-id="2"]');
        expect(orphan.parentElement).toBe(list);
        expect(orphan.dataset.groupId).toBeUndefined();
    });

    it('re-renders a flat row under its header once the group becomes known (Chrome race), and back', () => {
        const tabs = [fakeTab(1, 0, 2), fakeTab(2, 1, -1)];
        const list = document.getElementById('tab-list');

        tabRenderer.renderTabsAndGroups(tabs, [], { onAddToGroupClick: noop });
        const rowBefore = list.querySelector('.tab-item[data-tab-id="1"]');
        expect(rowBefore.parentElement).toBe(list);
        expect(rowBefore.dataset.groupId).toBeUndefined();

        tabRenderer.renderTabsAndGroups(tabs, [fakeGroup(2)], { onAddToGroupClick: noop });
        const rowAfter = list.querySelector('.tab-item[data-tab-id="1"]');
        expect(rowAfter).toBe(rowBefore); // element reused from the cache
        expect(rowAfter.parentElement.classList.contains('tab-group-content')).toBe(true);
        expect(rowAfter.dataset.groupId).toBe('2');

        tabRenderer.renderTabsAndGroups(tabs, [], { onAddToGroupClick: noop });
        const rowAgain = list.querySelector('.tab-item[data-tab-id="1"]');
        expect(rowAgain.parentElement).toBe(list);
        expect(rowAgain.dataset.groupId).toBeUndefined();
        expect(list.querySelectorAll('.tab-group-header').length).toBe(0);
    });
});

describe('renderOtherWindowsSection — grouped tabs whose group is unknown', () => {
    const otherWindow = (tabs) => ({ id: 20, type: 'normal', tabs: tabs.map(t => ({ ...t, windowId: 20 })) });

    it('renders them flat inside the window folder instead of dropping them', () => {
        const tabs = [fakeTab(1, 0, 5), fakeTab(2, 1, -1), fakeTab(3, 2, 5)];
        otherWindowRenderer.renderOtherWindowsSection([otherWindow(tabs)], 10, []);

        const folder = document.querySelector('#other-windows-list .folder-content');
        expect(folder).not.toBeNull();
        expect(rowIds(folder)).toEqual([1, 2, 3]);
        expect(folder.querySelectorAll('.tab-group-header').length).toBe(0);
        for (const row of folder.querySelectorAll('.tab-item')) {
            expect(row.parentElement).toBe(folder);
            expect(row.dataset.groupId).toBeUndefined();
        }
    });

    it('still renders known groups under their header (Chrome path unchanged)', () => {
        const tabs = [fakeTab(1, 0, 5), fakeTab(2, 1, -1), fakeTab(3, 2, 5)];
        otherWindowRenderer.renderOtherWindowsSection([otherWindow(tabs)], 10, [fakeGroup(5, { windowId: 20 })]);

        const folder = document.querySelector('#other-windows-list .folder-content');
        expect(folder.querySelectorAll('.tab-group-header').length).toBe(1);
        expect(rowIds(folder.querySelector('.tab-group-content'))).toEqual([1, 3]);
        const ungrouped = folder.querySelector('.tab-item[data-tab-id="2"]');
        expect(ungrouped.parentElement).toBe(folder);
    });
});
