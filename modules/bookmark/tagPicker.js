/**
 * Tag Picker — 共用的「標籤勾選」元件與其純邏輯。
 * 元件只負責呈現與回傳選取狀態，寫入由呼叫端決定（單一職責）。
 */

import * as tagManager from './tagManager.js';
import * as modal from '../modalManager.js';
import * as api from '../apiManager.js';

/**
 * 比較原本與選取後的標籤集合，算出差異。
 * @param {string[]} original 原本已貼的 tagId
 * @param {string[]} selected 使用者選取後的 tagId
 * @returns {{toAdd: string[], toRemove: string[]}}
 */
export function diffTagSelection(original, selected) {
    const o = new Set(original);
    const s = new Set(selected);
    return {
        toAdd: selected.filter(id => !o.has(id)),
        toRemove: original.filter(id => !s.has(id)),
    };
}

/**
 * 建立一個標籤勾選清單元件。
 * @param {string[]} initialTagIds 預先勾選的 tagId
 * @returns {{ element: HTMLElement, getSelectedTagIds: () => string[] }}
 */
export function createTagPicker(initialTagIds = []) {
    const selected = new Set(initialTagIds);

    const root = document.createElement('div');
    root.className = 'tag-picker';

    const list = document.createElement('div');
    list.className = 'tag-picker__list';
    root.appendChild(list);

    function addRow(tag) {
        const row = document.createElement('label');
        row.className = 'tag-picker__row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = tag.id;
        cb.checked = selected.has(tag.id);
        cb.addEventListener('change', () => {
            if (cb.checked) selected.add(tag.id); else selected.delete(tag.id);
            root.dispatchEvent(new CustomEvent('tagselectionchange', {
                detail: { tagId: tag.id, checked: cb.checked },
            }));
        });
        const chip = document.createElement('span');
        chip.className = 'bm-tools__tag-chip';
        chip.dataset.color = tag.color;
        chip.textContent = tag.name;
        row.appendChild(cb);
        row.appendChild(chip);
        list.appendChild(row);
    }

    for (const tag of tagManager.getAllTags()) addRow(tag);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'tag-picker__create';
    createBtn.textContent = api.getMessage('bmToolsCreateTag') || '+ New tag';
    createBtn.addEventListener('click', async () => {
        const name = await modal.showPrompt({
            title: api.getMessage('bmToolsCreateTagPrompt') || 'New tag name',
            defaultValue: '',
        });
        if (!name || !name.trim()) return;
        const tag = await tagManager.createTag({ name: name.trim() });
        selected.add(tag.id);
        addRow(tag);
    });
    root.appendChild(createBtn);

    return {
        element: root,
        getSelectedTagIds: () => Array.from(selected),
    };
}
