/**
 * Text Utilities Module
 * Provides safe text manipulation functions.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param {string} text - The text to escape
 * @returns {string} The escaped HTML string
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
