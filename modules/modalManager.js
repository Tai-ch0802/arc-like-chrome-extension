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
            // In a real app, you might have more input types, but for now, text is fine.
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field.name;
            input.className = 'modal-input';
            input.value = field.defaultValue || '';
            input.placeholder = field.label;
            form.appendChild(input);
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