/**
 * 書籤／資料夾的自訂右鍵選單。與分頁用的 contextMenuManager 分開，
 * 避免兩種情境耦合；沿用相同的 .custom-context-menu / .context-menu-item 樣式。
 */
import * as api from '../apiManager.js';
import * as tagManager from '../bookmark/tagManager.js';
import { createTagPicker } from '../bookmark/tagPicker.js';

/**
 * @param {number} x @param {number} y
 * @param {{id:string,url?:string,title?:string,isFolder:boolean}} node
 * @param {HTMLElement} originElement
 * @param {{ onScanFolder?: (folderId:string, tool:'duplicates'|'deadLinks', folderName?:string)=>void,
 *           onTagsChanged?: (bookmarkId:string)=>void }} handlers
 */
export function showBookmarkContextMenu(x, y, node, originElement, handlers = {}) {
    document.querySelector('.custom-context-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    menu.setAttribute('role', 'menu');
    menu.tabIndex = -1;
    if (x + 180 > window.innerWidth) x = window.innerWidth - 190;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const addItem = (label, onClick) => {
        const el = document.createElement('div');
        el.className = 'context-menu-item';
        el.setAttribute('role', 'menuitem');
        el.tabIndex = 0;
        el.innerHTML = `<span></span>`;
        el.querySelector('span').textContent = label;
        el.addEventListener('click', (e) => { e.stopPropagation(); onClick(el); });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onClick(el); }
            else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
        });
        menu.appendChild(el);
        return el;
    };

    if (node.isFolder) {
        addItem(api.getMessage('bmCtxScanDuplicates') || 'Find duplicates here',
            () => { handlers.onScanFolder?.(node.id, 'duplicates', node.title); closeMenu(); });
        addItem(api.getMessage('bmCtxScanDeadLinks') || 'Check dead links here',
            () => { handlers.onScanFolder?.(node.id, 'deadLinks', node.title); closeMenu(); });
    } else {
        if (node.url) {
            addItem(api.getMessage('copyUrl') || 'Copy URL', async () => {
                try { await navigator.clipboard.writeText(node.url); } catch {}
                closeMenu();
            });
        }
        addItem(api.getMessage('bmCtxManageTags') || 'Manage tags', () => {
            openTagPopover();
        });
    }

    document.body.appendChild(menu);
    menu.querySelector('.context-menu-item')?.focus();

    function openTagPopover() {
        // 將管理標籤展開為一個就地的勾選清單；勾選即時寫入。
        const original = tagManager.getTagsForBookmark(node.id).map(t => t.id);
        const picker = createTagPicker(original);
        picker.element.classList.add('tag-picker--popover');
        picker.element.addEventListener('tagselectionchange', async (e) => {
            const { tagId, checked } = e.detail;
            if (checked) await tagManager.addTagToBookmark(node.id, tagId);
            else await tagManager.removeTagFromBookmark(node.id, tagId);
            handlers.onTagsChanged?.(node.id);
        });
        menu.innerHTML = '';
        menu.appendChild(picker.element);
        picker.element.querySelector('input, button')?.focus();
    }

    function closeMenu() {
        menu.remove();
        document.removeEventListener('click', handleOutside);
        document.removeEventListener('contextmenu', handleOutside);
        if (originElement) originElement.focus();
    }
    function handleOutside(e) { if (!menu.contains(e.target)) closeMenu(); }
    setTimeout(() => {
        document.addEventListener('click', handleOutside);
        document.addEventListener('contextmenu', handleOutside);
    }, 0);
}
