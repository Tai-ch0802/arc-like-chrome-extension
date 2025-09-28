import * as api from './apiManager.js';

function createModal(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.innerHTML = content;

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
        const content = `
            <h3 class="modal-title">${title}</h3>
            <input type="text" class="modal-input" value="${defaultValue}">
            <div class="modal-buttons">
                <button class="modal-button cancel-btn">${api.getMessage("cancelButton") || 'Cancel'}</button>
                <button class="modal-button confirm-btn primary">${confirmButtonText}</button>
            </div>
        `;

        const { overlay, modalContent } = createModal(content);

        const confirmBtn = modalContent.querySelector('.confirm-btn');
        const cancelBtn = modalContent.querySelector('.cancel-btn');
        const input = modalContent.querySelector('.modal-input');
        input.focus();
        input.select();

        const cleanupAndResolve = (value) => {
            removeModal(overlay);
            resolve(value);
        };

        confirmBtn.onclick = () => cleanupAndResolve(input.value);
        cancelBtn.onclick = () => cleanupAndResolve(null);
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanupAndResolve(null);
            }
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                cleanupAndResolve(input.value);
            } else if (e.key === 'Escape') {
                cleanupAndResolve(null);
            }
        };
    });
}
