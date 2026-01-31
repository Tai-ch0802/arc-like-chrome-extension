import * as api from './apiManager.js';
import { escapeHtml } from './utils/textUtils.js';
import { GROUP_COLORS } from './ui/groupColors.js';

/**
 * 追蹤目前開啟的 Modal 相關資訊，用於 Focus 管理
 * @type {{ overlay: HTMLElement, modalContent: HTMLElement, previousActiveElement: HTMLElement, cleanup: Function } | null}
 */
let currentModal = null;

function createModal(content) {
    // 記錄開啟前的焦點元素，以便關閉後還原
    const previousActiveElement = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    // 確保 modalContent 可以被聚焦 (若是點擊 overlay 背景，我們希望 focus 回到內容)
    modalContent.tabIndex = -1;

    if (typeof content === 'string') {
        modalContent.innerHTML = content;
    } else {
        modalContent.appendChild(content);
    }

    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);

    // Lock body scroll to prevent scroll-through
    document.body.style.overflow = 'hidden';

    // 定義 Focus Trap 邏輯
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            // 嘗試尋找並點擊取消/關閉按鈕，或觸發 Overlay 點擊
            // 優先尋找明確的取消按鈕
            const cancelBtn = modalContent.querySelector('.cancel-btn, #closeButton');
            if (cancelBtn) {
                cancelBtn.click();
            } else {
                // 若無取消按鈕，則模擬點擊 Overlay (通常綁定有關閉邏輯)
                overlay.click();
            }
            return;
        }

        if (e.key === 'Tab') {
            const focusableElements = modalContent.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else { // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
        // Arrow Key Navigation (Global)
        // Only handle if not on a text input/textarea (to preserve caret movement)
        else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            const activeTag = document.activeElement.tagName.toLowerCase();
            const isTextInput = (activeTag === 'input' && ['text', 'password', 'search', 'email', 'number', 'url', 'tel'].includes(document.activeElement.type)) || activeTag === 'textarea';

            if (!isTextInput) {
                e.preventDefault();
                const focusableElements = Array.from(modalContent.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                ));

                if (focusableElements.length === 0) return;

                const currentIndex = focusableElements.indexOf(document.activeElement);
                let nextIndex = currentIndex;

                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    nextIndex = currentIndex + 1;
                    if (nextIndex >= focusableElements.length) nextIndex = 0; // Loop (optional, but good for arrows)
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    nextIndex = currentIndex - 1;
                    if (nextIndex < 0) nextIndex = focusableElements.length - 1; // Loop
                }

                if (nextIndex >= 0 && nextIndex < focusableElements.length) {
                    focusableElements[nextIndex].focus();
                }
            }
        }
    };

    document.addEventListener('keydown', handleKeyDown);

    // 保存目前的 Modal 狀態
    currentModal = {
        overlay,
        modalContent,
        previousActiveElement,
        cleanup: () => {
            document.removeEventListener('keydown', handleKeyDown);
            currentModal = null;
        }
    };

    return { overlay, modalContent };
}

function removeModal(overlay) {
    if (overlay) {
        overlay.remove();
    }

    // 執行清理並還原焦點
    if (currentModal && currentModal.overlay === overlay) {
        const { previousActiveElement } = currentModal;
        currentModal.cleanup();
        if (previousActiveElement && document.body.contains(previousActiveElement)) {
            previousActiveElement.focus();
        }
    }

    // Unlock body scroll
    document.body.style.overflow = '';
}

export function showConfirm({ title, confirmButtonText = 'Confirm', confirmButtonClass = 'primary' }) {
    return new Promise((resolve) => {
        const content = `
            <h3 class="modal-title">${escapeHtml(title)}</h3>
            <div class="modal-buttons">
                <button class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
                <button class="modal-button confirm-btn ${confirmButtonClass}">${escapeHtml(confirmButtonText)}</button>
            </div>
        `;

        const { overlay, modalContent } = createModal(content);

        // 設定初始焦點
        const confirmBtn = modalContent.querySelector('.confirm-btn');
        const cancelBtn = modalContent.querySelector('.cancel-btn');
        cancelBtn.focus(); // 預設聚焦在取消按鈕，避免誤主操作

        const cleanupAndResolve = (value) => {
            removeModal(overlay);
            resolve(value);
        };

        confirmBtn.onclick = () => cleanupAndResolve(true);
        cancelBtn.onclick = () => cleanupAndResolve(false);
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupAndResolve(false);
            }
        };
    });
}

export function showPrompt({ title, confirmButtonText = 'Confirm', defaultValue = '' }) {
    return new Promise((resolve) => {
        const form = document.createElement('form');
        form.noValidate = true;
        form.innerHTML = `
            <h3 class="modal-title">${escapeHtml(title)}</h3>
            <input type="text" class="modal-input" value="${escapeHtml(defaultValue)}">
            <div class="modal-buttons">
                <button type="button" class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
                <button type="submit" class="modal-button confirm-btn primary">${escapeHtml(confirmButtonText)}</button>
            </div>
        `;

        const { overlay, modalContent } = createModal(form);

        const cancelBtn = modalContent.querySelector('.cancel-btn');
        const input = modalContent.querySelector('.modal-input');
        input.focus();
        input.select();

        const cleanupAndResolve = (value) => {
            removeModal(overlay);
            resolve(value);
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            cleanupAndResolve(input.value);
        };
        cancelBtn.onclick = () => cleanupAndResolve(null);
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupAndResolve(null);
            }
        };
    });
}

export function showFormDialog({ title, fields, confirmButtonText = 'Confirm' }) {
    return new Promise((resolve) => {
        const form = document.createElement('form');
        form.noValidate = true;

        const titleEl = document.createElement('h3');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        form.appendChild(titleEl);

        fields.forEach(field => {
            if (field.type === 'select') {
                const select = document.createElement('select');
                select.name = field.name;
                select.className = 'modal-select'; // Apply the new CSS class
                field.options.forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option.value;
                    optionEl.textContent = option.label;
                    if (option.value === field.defaultValue) {
                        optionEl.selected = true;
                    }
                    select.appendChild(optionEl);
                });
                form.appendChild(select);
            } else { // Default to text input
                const input = document.createElement('input');
                input.type = field.type || 'text'; // Allow other input types or default to text
                input.name = field.name;
                input.className = 'modal-input';
                input.value = field.defaultValue || '';
                input.placeholder = field.label;
                form.appendChild(input);
            }
        });

        const buttons = document.createElement('div');
        buttons.className = 'modal-buttons';
        buttons.innerHTML = `
            <button type="button" class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
            <button type="submit" class="modal-button confirm-btn primary">${confirmButtonText}</button>
        `;
        form.appendChild(buttons);

        const { overlay, modalContent } = createModal(form);
        const firstInput = modalContent.querySelector('input, select');
        if (firstInput) {
            firstInput.focus();
            if (firstInput.select) firstInput.select();
        }

        const cleanupAndResolve = (value) => {
            removeModal(overlay);
            resolve(value);
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const result = {};
            for (const [name, value] of formData.entries()) {
                result[name] = value;
            }
            cleanupAndResolve(result);
        };

        const cancelBtn = modalContent.querySelector('.cancel-btn');
        cancelBtn.onclick = () => cleanupAndResolve(null);
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupAndResolve(null);
            }
        };
    });
}

export function showCustomDialog({ title, content, closeButtonText = api.getMessage("closeButton") || 'Close', onOpen = () => { } }) {
    return new Promise((resolve) => {
        // Create elements directly to avoid intermediate wrapper div
        const titleEl = document.createElement('h3');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;

        const customContentEl = document.createElement('div');
        customContentEl.className = 'modal-custom-content';
        if (content instanceof Node) {
            customContentEl.appendChild(content);
        } else {
            customContentEl.innerHTML = content;
        }

        const buttonsEl = document.createElement('div');
        buttonsEl.className = 'modal-buttons';

        const closeBtnEl = document.createElement('button');
        closeBtnEl.className = 'modal-button';
        closeBtnEl.id = 'closeButton';
        closeBtnEl.textContent = closeButtonText;
        buttonsEl.appendChild(closeBtnEl);

        // Create a DocumentFragment to hold all elements
        const fragment = document.createDocumentFragment();
        fragment.appendChild(titleEl);
        fragment.appendChild(customContentEl);
        fragment.appendChild(buttonsEl);

        const { overlay, modalContent } = createModal(fragment);

        onOpen(modalContent); // 在內容被添加到 DOM 後執行 onOpen 回呼函式

        // 如果內容中沒有可聚焦元素，預設聚焦在關閉按鈕
        const contentFocusable = modalContent.querySelector('.modal-custom-content input, .modal-custom-content button');
        if (contentFocusable) {
            contentFocusable.focus();
        } else {
            closeBtnEl.focus();
        }

        const cleanupAndResolve = () => {
            removeModal(overlay);
            resolve();
        };

        closeBtnEl.onclick = () => cleanupAndResolve();
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupAndResolve();
            }
        };
    });
}

export function showAddToBookmarkDialog({ name, url }) {
    return new Promise(async (resolve) => {
        const form = document.createElement('form');
        form.noValidate = true;
        form.className = 'add-bookmark-form';

        let selectedFolder = { id: '1', path: api.getMessage("bookmarksBar") || "Bookmarks Bar" };
        let selectedFolderElement = null;

        const tree = await api.getBookmarkTree();
        const rootFolders = tree[0]?.children || [];

        form.innerHTML = `
            <h3 class="modal-title">${api.getMessage("addBookmarkDialogTitle") || "Add Bookmark"}</h3>
            <input type="text" name="title" class="modal-input" value="${escapeHtml(name)}">
            <input type="text" name="url" class="modal-input" value="${escapeHtml(url)}">
            <div class="modal-location-path">${escapeHtml(selectedFolder.path)}</div>
            <div class="modal-bookmark-tree"></div>
            <div class="modal-buttons">
                <button type="button" class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
                <button type="submit" class="modal-button confirm-btn primary">${api.getMessage("addButton") || 'Add'}</button>
            </div>
        `;

        const locationPathDiv = form.querySelector('.modal-location-path');
        const treeContainer = form.querySelector('.modal-bookmark-tree');

        function renderFolders(nodes, container, path) {
            nodes.forEach(node => {
                if (node.children) { // It's a folder
                    const folderItem = document.createElement('div');
                    folderItem.className = 'bookmark-folder';
                    folderItem.dataset.bookmarkId = node.id;
                    folderItem.title = node.title;
                    folderItem.tabIndex = 0; // Make focusable
                    folderItem.setAttribute('role', 'button'); // Accessibility role

                    const icon = document.createElement('span');
                    icon.className = 'bookmark-icon';
                    icon.textContent = '▼'; // Always expanded

                    const title = document.createElement('span');
                    title.className = 'bookmark-title';
                    title.textContent = node.title || api.getMessage("bookmarksBar") || "Bookmarks Bar";

                    folderItem.appendChild(icon);
                    folderItem.appendChild(title);

                    const newPath = path ? `${path} / ${title.textContent}` : title.textContent;

                    const selectFolder = () => {
                        selectedFolder = { id: node.id, path: newPath };
                        locationPathDiv.textContent = newPath;
                        if (selectedFolderElement) {
                            selectedFolderElement.classList.remove('selected');
                        }
                        folderItem.classList.add('selected');
                        selectedFolderElement = folderItem;
                    };

                    folderItem.addEventListener('click', selectFolder);
                    folderItem.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectFolder();
                        }
                    });

                    container.appendChild(folderItem);

                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'folder-content'; // Reuse style
                    childrenContainer.style.display = 'block'; // Always expanded
                    container.appendChild(childrenContainer);

                    if (node.children.length > 0) {
                        renderFolders(node.children, childrenContainer, newPath);
                    }
                }
            });
        }

        renderFolders(rootFolders, treeContainer, '');

        // Optimize: Cache the folder list for keyboard navigation instead of querying on every keypress
        const allFolders = Array.from(treeContainer.querySelectorAll('.bookmark-folder'));

        treeContainer.addEventListener('keydown', (e) => {
            if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
                // Only handle if focus is on a folder (or bubbling up from one)
                if (e.target.classList.contains('bookmark-folder')) {
                    e.preventDefault();
                    e.stopPropagation(); // Stop bubbling to global handler

                    const index = allFolders.indexOf(e.target);
                    if (index !== -1) {
                        let nextIndex = index;
                        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                            nextIndex = index + 1;
                            if (nextIndex >= allFolders.length) nextIndex = 0;
                        } else {
                            nextIndex = index - 1;
                            if (nextIndex < 0) nextIndex = allFolders.length - 1;
                        }

                        if (allFolders[nextIndex]) {
                            allFolders[nextIndex].focus();
                        }
                    }
                }
            }
        });

        const firstFolder = treeContainer.querySelector('.bookmark-folder');
        if (firstFolder) {
            firstFolder.classList.add('selected');
            selectedFolderElement = firstFolder;
        }


        const { overlay, modalContent } = createModal(form);
        const firstInput = modalContent.querySelector('input');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }

        const cleanupAndResolve = (value) => {
            removeModal(overlay);
            resolve(value);
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const result = {
                parentId: selectedFolder.id,
                title: formData.get('title'),
                url: formData.get('url')
            };
            cleanupAndResolve(result);
        };

        const cancelBtn = modalContent.querySelector('.cancel-btn');
        cancelBtn.onclick = () => cleanupAndResolve(null);
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupAndResolve(null);
            }
        };
    });
}


export function showCreateGroupDialog() {
    return new Promise((resolve) => {
        const form = document.createElement('form');
        form.noValidate = true;
        form.className = 'create-group-form';

        let selectedColor = 'grey'; // Default color

        const colorSwatches = Object.entries(GROUP_COLORS).map(([colorName, colorHex]) => `
            <div class="color-swatch ${colorName === selectedColor ? 'selected' : ''}" 
                 data-color="${colorName}" 
                 style="background-color: ${colorHex};"
                 tabindex="0"
                 role="radio"
                 aria-checked="${colorName === selectedColor}"
                 aria-label="${colorName}"></div>
        `).join('');

        form.innerHTML = `
            <h3 class="modal-title">${api.getMessage("createGroupDialogTitle") || "Create New Group"}</h3>
            <input type="text" class="modal-input" placeholder="${api.getMessage("groupNameInputPlaceholder") || "Enter group name..."}">
            <div class="color-swatches-container" role="radiogroup">${colorSwatches}</div>
            <div class="modal-buttons">
                <button type="button" class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
                <button type="submit" class="modal-button confirm-btn primary">${api.getMessage("createGroupButton") || 'Create Group'}</button>
            </div>
        `;

        const { overlay, modalContent } = createModal(form);

        const input = modalContent.querySelector('.modal-input');
        input.focus();

        const swatchesContainer = modalContent.querySelector('.color-swatches-container');

        // Helper to update selection
        const selectSwatch = (target) => {
            const previouslySelected = swatchesContainer.querySelector('.selected');
            if (previouslySelected) {
                previouslySelected.classList.remove('selected');
                previouslySelected.setAttribute('aria-checked', 'false');
            }
            target.classList.add('selected');
            target.setAttribute('aria-checked', 'true');
            selectedColor = target.dataset.color;
        }

        swatchesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                selectSwatch(e.target);
            }
        });

        // Add Keyboard support for swatches
        swatchesContainer.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('color-swatch')) {
                e.preventDefault();
                selectSwatch(e.target);
            }

            // Grid Navigation for Swatches
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && e.target.classList.contains('color-swatch')) {
                e.preventDefault();
                e.stopPropagation(); // Stop global handler

                const allSwatches = Array.from(swatchesContainer.querySelectorAll('.color-swatch'));
                const index = allSwatches.indexOf(e.target);
                let nextIndex = index;

                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    nextIndex = index + 1;
                    if (nextIndex >= allSwatches.length) nextIndex = 0;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    nextIndex = index - 1;
                    if (nextIndex < 0) nextIndex = allSwatches.length - 1;
                }

                if (nextIndex >= 0 && nextIndex < allSwatches.length) {
                    allSwatches[nextIndex].focus();
                }
            }
        });

        const cleanupAndResolve = (value) => {
            removeModal(overlay);
            resolve(value);
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const title = input.value.trim();
            if (title) {
                cleanupAndResolve({ title, color: selectedColor });
            } else {
                input.focus();
            }
        };

        const cancelBtn = modalContent.querySelector('.cancel-btn');
        cancelBtn.onclick = () => cleanupAndResolve(null);
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupAndResolve(null);
            }
        };
    });
}
