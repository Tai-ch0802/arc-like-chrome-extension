// --- Archive / Snooze Store ---
// CRUD over chrome.storage.local `archivedTabs` / `snoozedTabs`
// (BASE-024 SA §4.1). Shared by the SW engine and the sidepanel UI.
// All writes that gate a tab close use setStorageStrict: FR-1.04/4.02 depend
// on write FAILURES being observable so the tab is never closed unpersisted.

import * as api from '../apiManager.js';
import { ARCHIVE_MAX_ITEMS } from './lifecycleLogic.js';

export const ARCHIVED_KEY = 'archivedTabs';
export const SNOOZED_KEY = 'snoozedTabs';

const EMPTY = () => ({ schemaVersion: 1, items: [] });

async function readList(key) {
    const res = await api.getStorage('local', { [key]: null });
    const state = res[key];
    if (!state || !Array.isArray(state.items)) return EMPTY();
    return { schemaVersion: state.schemaVersion || 1, items: state.items };
}

/** @returns {Promise<{schemaVersion:number, items:Array}>} newest first */
export function getArchived() {
    return readList(ARCHIVED_KEY);
}

/**
 * Prepend a batch (newest first) and enforce the FIFO cap (FR-2.01).
 * Throws on storage failure — callers MUST NOT close tabs when this rejects.
 */
export async function addArchived(newItems) {
    const state = await readList(ARCHIVED_KEY);
    state.items = [...newItems, ...state.items].slice(0, ARCHIVE_MAX_ITEMS);
    await api.setStorageStrict('local', { [ARCHIVED_KEY]: state });
}

export async function removeArchived(ids) {
    const state = await readList(ARCHIVED_KEY);
    const drop = new Set(ids);
    state.items = state.items.filter(i => !drop.has(i.id));
    await api.setStorageStrict('local', { [ARCHIVED_KEY]: state });
}

export async function clearArchived() {
    await api.setStorageStrict('local', { [ARCHIVED_KEY]: EMPTY() });
}

/** @returns {Promise<{schemaVersion:number, items:Array}>} */
export function getSnoozed() {
    return readList(SNOOZED_KEY);
}

/** Throws on storage failure — the snooze flow closes the tab only after this resolves. */
export async function addSnoozed(item) {
    const state = await readList(SNOOZED_KEY);
    state.items = [item, ...state.items];
    await api.setStorageStrict('local', { [SNOOZED_KEY]: state });
}

export async function removeSnoozed(id) {
    const state = await readList(SNOOZED_KEY);
    state.items = state.items.filter(i => i.id !== id);
    await api.setStorageStrict('local', { [SNOOZED_KEY]: state });
}
