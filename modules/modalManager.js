import * as api from './apiManager.js';

function createModal(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Don't use innerHTML for content that includes a form, to ensure proper event handling
    if (typeof content === 'string') {
        modalContent.innerHTML = content;
    } else {
        modalContent.appendChild(content);
    }

    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);

    return { overlay, modalContent };
}

function removeModal(overlay) {
    if (overlay) {
        overlay.remove();
    }
}

export function showConfirm({ title, confirmButtonText = 'Confirm', confirmButtonClass = 'primary' }) {
    return new Promise((resolve) => {
        const content = `
            <h3 class="modal-title">${title}</h3>
            <div class="modal-buttons">
                <button class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
                <button class="modal-button confirm-btn ${confirmButtonClass}">${confirmButtonText}</button>
            </div>
        `;

        const { overlay, modalContent } = createModal(content);

        const confirmBtn = modalContent.querySelector('.confirm-btn');
        const cancelBtn = modalContent.querySelector('.cancel-btn');

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
            <h3 class="modal-title">${title}</h3>
            <input type="text" class="modal-input" value="${defaultValue}">
            <div class="modal-buttons">
                <button type="button" class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
                <button type="submit" class="modal-button confirm-btn primary">${confirmButtonText}</button>
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

export function showCustomDialog({ title, content, closeButtonText = api.getMessage("closeButton") || 'Close', onOpen = () => {} }) {
    return new Promise((resolve) => {
        const dialogContent = document.createElement('div');

        dialogContent.innerHTML = `
            <h3 class="modal-title">${title}</h3>
            <div class="modal-custom-content">${content}</div>
            <div class="modal-buttons">
                <button class="modal-button" id="closeButton">${closeButtonText}</button>
            </div>
        `;

        const { overlay, modalContent } = createModal(dialogContent);

        onOpen(modalContent); // 在內容被添加到 DOM 後執行 onOpen 回呼函式

        const closeBtn = modalContent.querySelector('#closeButton');

        const cleanupAndResolve = () => {
            removeModal(overlay);
            resolve();
        };

        closeBtn.onclick = () => cleanupAndResolve();
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
            <input type="text" name="title" class="modal-input" value="${name}">
            <input type="text" name="url" class="modal-input" value="${url}">
            <div class="modal-location-path">${selectedFolder.path}</div>
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
                    folderItem.className = 'bookmark-folder'; // Reuse style
                    folderItem.dataset.bookmarkId = node.id;
                    folderItem.title = node.title;

                    const icon = document.createElement('span');
                    icon.className = 'bookmark-icon';
                    icon.textContent = '▼'; // Always expanded

                    const title = document.createElement('span');
                    title.className = 'bookmark-title';
                    title.textContent = node.title || api.getMessage("bookmarksBar") || "Bookmarks Bar";

                    folderItem.appendChild(icon);
                    folderItem.appendChild(title);

                    const newPath = path ? `${path} / ${title.textContent}` : title.textContent;

                    folderItem.addEventListener('click', () => {
                        selectedFolder = { id: node.id, path: newPath };
                        locationPathDiv.textContent = newPath;
                        if (selectedFolderElement) {
                            selectedFolderElement.classList.remove('selected');
                        }
                        folderItem.classList.add('selected');
                        selectedFolderElement = folderItem;
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
